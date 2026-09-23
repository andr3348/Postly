import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
  type AuthenticatedUser,
} from '../../../shared/decorators.js';
import {
  TOKEN_ISSUER,
  type TokenIssuer,
} from '../domain/ports/token-issuer.port.js';

interface AuthenticatedRequest {
  readonly headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

/**
 * Guard de autenticación JWT (sin passport, a propósito: menos
 * dependencias para el alcance simple de esta fase).
 * Verifica el Bearer access token y expone `request.user`.
 * Rutas marcadas con `@Public()` se omiten.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuer,
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
    const token = extractBearerToken(request.headers.authorization);
    if (token === null) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const payload = await this.issuer.verifyAccessToken(token);
    if (payload === null) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    request.user = payload;
    return true;
  }
}

function extractBearerToken(
  header: string | string[] | undefined,
): string | null {
  if (typeof header !== 'string') {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (
    scheme?.toLowerCase() !== 'bearer' ||
    token === undefined ||
    token === ''
  ) {
    return null;
  }
  return token;
}
