import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser, Public, type AuthenticatedUser } from '../../../shared/decorators.js';
import { InvalidRefreshTokenError } from '../../../shared/errors.js';
import { GetMeUseCase } from '../application/get-me.use-case.js';
import { ListAuthSessionsUseCase } from '../application/list-auth-sessions.use-case.js';
import { LoginUseCase } from '../application/login.use-case.js';
import { LogoutUseCase } from '../application/logout.use-case.js';
import { RefreshUseCase } from '../application/refresh.use-case.js';
import { RegisterUseCase } from '../application/register.use-case.js';
import { RevokeAuthSessionUseCase } from '../application/revoke-auth-session.use-case.js';
import { RevokeOtherSessionsUseCase } from '../application/revoke-other-sessions.use-case.js';
import type { AuthResult, AuthSessionView } from '../domain/auth-session.entity.js';
import type { SafeUser } from '../domain/user.entity.js';
import {
  AUTH_COOKIES,
  authCookieOptions,
  clearAuthCookies,
} from '../infrastructure/auth-cookies.js';
import {
  AUTH_JWT_OPTIONS,
  type AuthJwtOptions,
} from '../infrastructure/auth-jwt.options.js';
import { loginSchema, type LoginDto } from './schemas/login.schema.js';
import { registerSchema, type RegisterDto } from './schemas/register.schema.js';

const MAX_USER_AGENT = 512;
const MAX_IP = 64;

/**
 * Controller delgado: valida (Zod), delega al caso de uso, fija cookies
 * HttpOnly y retorna solo `{ user }`. Los tokens jamás van en el JSON.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly listSessionsUseCase: ListAuthSessionsUseCase,
    private readonly revokeSessionUseCase: RevokeAuthSessionUseCase,
    private readonly revokeOtherSessionsUseCase: RevokeOtherSessionsUseCase,
    @Inject(AUTH_JWT_OPTIONS) private readonly options: AuthJwtOptions,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body({ schema: registerSchema }) body: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SafeUser }> {
    const output = await this.registerUseCase.execute({
      ...body,
      ...requestContext(req),
    });
    this.setAuthCookies(res, output);
    return { user: output.user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body({ schema: loginSchema }) body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SafeUser }> {
    const output = await this.loginUseCase.execute({
      ...body,
      ...requestContext(req),
    });
    this.setAuthCookies(res, output);
    return { user: output.user };
  }

  /**
   * Rotación: el refresh viaja en su cookie HttpOnly (el JS no puede leerlo,
   * así que no va en el cuerpo). Respuesta: access JWT nuevo + refresh opaco
   * nuevo (rotado) en cookies + `{ user }`.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SafeUser }> {
    const refreshToken = req.cookies?.[AUTH_COOKIES.refresh];
    if (typeof refreshToken !== 'string' || refreshToken === '') {
      clearAuthCookies(res);
      throw new InvalidRefreshTokenError();
    }
    try {
      const output = await this.refreshUseCase.execute({ refreshToken });
      this.setAuthCookies(res, output);
      return { user: output.user };
    } catch (error: unknown) {
      // Cookie inválida/reutilizada: el navegador debe soltarla.
      clearAuthCookies(res);
      throw error;
    }
  }

  /**
   * Logout con revocación en servidor. Público a propósito: funciona aunque
   * el access JWT ya haya expirado; el refresh identifica la sesión.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken = req.cookies?.[AUTH_COOKIES.refresh];
    await this.logoutUseCase.execute({
      refreshToken: typeof refreshToken === 'string' ? refreshToken : null,
    });
    clearAuthCookies(res);
  }

  /** Perfil propio con nombre real (el JWT no lo incluye). */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<SafeUser> {
    return this.getMeUseCase.execute(user.userId);
  }

  /** Sesiones activas del usuario (multi-dispositivo). */
  @Get('sessions')
  sessions(@CurrentUser() user: AuthenticatedUser): Promise<AuthSessionView[]> {
    return this.listSessionsUseCase.execute({
      userId: user.userId,
      currentSessionId: user.sessionId,
    });
  }

  /** Revoca una sesión propia. Si es la actual, también limpia cookies. */
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const output = await this.revokeSessionUseCase.execute({
      userId: user.userId,
      sessionId,
      currentSessionId: user.sessionId,
    });
    if (output.revokedCurrent) {
      clearAuthCookies(res);
    }
  }

  /** Cierra todas las sesiones menos la actual. */
  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeOtherSessions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.revokeOtherSessionsUseCase.execute({
      userId: user.userId,
      currentSessionId: user.sessionId,
    });
  }

  /**
   * Con "Mantener sesión activa" ambas cookies son persistentes; sin él son
   * cookies de sesión (mueren al cerrar el navegador). El TTL del access
   * sigue siendo corto: la persistencia no extiende su validez.
   */
  private setAuthCookies(res: Response, output: AuthResult): void {
    const persistent = output.session.persistent;
    res.cookie(
      AUTH_COOKIES.access,
      output.tokens.accessToken,
      authCookieOptions({
        maxAgeMs: persistent
          ? this.options.accessExpiresInSeconds * 1000
          : undefined,
      }),
    );
    res.cookie(
      AUTH_COOKIES.refresh,
      output.tokens.refreshToken,
      authCookieOptions({
        maxAgeMs: persistent
          ? this.options.refreshExpiresInSeconds * 1000
          : undefined,
      }),
    );
  }
}

function requestContext(req: Request): {
  userAgent: string | null;
  ip: string | null;
} {
  const rawAgent = req.headers['user-agent'];
  const userAgent =
    typeof rawAgent === 'string' ? rawAgent.slice(0, MAX_USER_AGENT) : null;
  const ip = typeof req.ip === 'string' ? req.ip.slice(0, MAX_IP) : null;
  return { userAgent, ip };
}
