import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../shared/decorators.js';
import {
  AUTH_SESSIONS_REPOSITORY,
  type AuthSessionsRepository,
} from '../domain/ports/auth-sessions.repository.js';
import { TOKEN_ISSUER, type TokenIssuer } from '../domain/ports/token-issuer.port.js';
import {
  AUTH_COOKIES,
  type AuthenticatedRequest,
} from './auth-cookies.js';

/**
 * Guard de autenticación JWT (sin passport).
 * Lee el access token de su cookie HttpOnly, verifica la firma/expiración y
 * comprueba que la sesión (`sid`) siga activa. Esa segunda comprobación es
 * la que permite revocar una sesión desde otro dispositivo de inmediato.
 * Rutas marcadas con `@Public()` se omiten.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuer,
    @Inject(AUTH_SESSIONS_REPOSITORY)
    private readonly sessions: AuthSessionsRepository,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[AUTH_COOKIES.access];
    if (typeof token !== 'string' || token === '') {
      throw new UnauthorizedException('Missing access token cookie');
    }
    const payload = await this.issuer.verifyAccessToken(token);
    if (payload === null) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const active = await this.sessions.isActive(
      payload.sessionId,
      payload.userId,
      new Date(),
    );
    if (!active) {
      throw new UnauthorizedException('Session revoked or expired');
    }
    request.user = payload;
    return true;
  }
}
