/**
 * Transporte de tokens: cookies HttpOnly (nunca JSON).
 * El access token en el cuerpo expondría la sesión a XSS vía JS;
 * HttpOnly lo oculta del `document.cookie` por completo.
 * Nombres centralizados: los usan el controller (escritura/borrado) y el guard (lectura).
 */
import type { Request, Response } from 'express';
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
  /** `undefined` = cookie de sesión (muere al cerrar el navegador). */
  readonly maxAgeMs?: number;
}

export interface AuthCookieOptions {
  readonly httpOnly: true;
  readonly sameSite: 'lax';
  readonly secure: boolean;
  readonly path: string;
  readonly maxAge?: number;
}

/** `secure` solo en producción: en local el tráfico es HTTP sin TLS. */
export function authCookieOptions({
  maxAgeMs,
}: CookieOptions = {}): AuthCookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}

/** Borra ambas cookies de auth (logout o refresh inválido). */
export function clearAuthCookies(res: Response): void {
  const options = authCookieOptions();
  res.clearCookie(AUTH_COOKIES.access, options);
  res.clearCookie(AUTH_COOKIES.refresh, options);
}
