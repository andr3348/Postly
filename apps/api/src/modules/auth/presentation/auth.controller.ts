import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser, Public, type AuthenticatedUser } from '../../../shared/decorators.js';
import { InvalidRefreshTokenError } from '../../../shared/errors.js';
import { LoginUseCase } from '../application/login.use-case.js';
import { RefreshUseCase } from '../application/refresh.use-case.js';
import { RegisterUseCase } from '../application/register.use-case.js';
import type { SafeUser } from '../domain/user.entity.js';
import {
  AUTH_COOKIES,
  authCookieOptions,
} from '../infrastructure/auth-cookies.js';
import {
  AUTH_JWT_OPTIONS,
  type AuthJwtOptions,
} from '../infrastructure/auth-jwt.options.js';
import { loginSchema, type LoginDto } from './schemas/login.schema.js';
import { registerSchema, type RegisterDto } from './schemas/register.schema.js';

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
    @Inject(AUTH_JWT_OPTIONS) private readonly options: AuthJwtOptions,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body({ schema: registerSchema }) body: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SafeUser }> {
    const output = await this.registerUseCase.execute(body);
    this.setAuthCookies(res, output.tokens.accessToken, output.tokens.refreshToken);
    return { user: output.user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body({ schema: loginSchema }) body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SafeUser }> {
    const output = await this.loginUseCase.execute(body);
    this.setAuthCookies(res, output.tokens.accessToken, output.tokens.refreshToken);
    return { user: output.user };
  }

  /**
   * Rotación: el refresh viaja en su cookie HttpOnly (el JS no puede leerlo,
   * así que no va en el cuerpo). Respuesta: par nuevo en cookies + `{ user }`.
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
      // Sin cookie no hay nada que verificar: mismo 401 vía el filtro.
      throw new InvalidRefreshTokenError();
    }
    const output = await this.refreshUseCase.execute({ refreshToken });
    this.setAuthCookies(res, output.tokens.accessToken, output.tokens.refreshToken);
    return { user: output.user };
  }

  /** Sonda autenticada: verifica guard + `@CurrentUser` de punta a punta. */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie(
      AUTH_COOKIES.access,
      accessToken,
      authCookieOptions({ maxAgeMs: this.options.accessExpiresInSeconds * 1000 }),
    );
    res.cookie(
      AUTH_COOKIES.refresh,
      refreshToken,
      authCookieOptions({ maxAgeMs: this.options.refreshExpiresInSeconds * 1000 }),
    );
  }
}
