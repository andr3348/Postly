/**
 * Transporte de tokens: cookies HttpOnly (nunca JSON).
 * El access token en el cuerpo expondría la sesión a XSS vía JS;
 * HttpOnly lo oculta del `document.cookie` por completo.
 * Nombres centralizados: los usan el controller (escritura) y el guard (lectura).
 */
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../../shared/decorators.js';

export const AUTH_COOKIES = {
  access: 'accessToken',
  refresh: 'refreshToken',
} as const;

/**
 * Request ya autenticada por el guard (`request.user` presente).
 * `request.cookies` viene tipado del propio Express y garantizado en
 * runtime por `cookie-parser` (ver `main.ts`): no se redeclara.
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface CookieOptions {
  readonly maxAgeMs: number;
}

/** `secure` solo en producción: en local el tráfico es HTTP sin TLS. */
export function authCookieOptions({ maxAgeMs }: CookieOptions): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: maxAgeMs,
  };
}
