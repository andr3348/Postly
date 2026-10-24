import { ApiError, apiJson } from '@/lib/api';
import {
  loginSchema,
  registerSchema,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
} from './schemas';

/**
 * Capa API del feature auth. Traduce estados HTTP a mensajes en español;
 * los componentes nunca hacen `fetch` crudo ni conocen rutas.
 */
export async function login(input: LoginInput): Promise<{ user: AuthUser }> {
  try {
    return await apiJson<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      data: loginSchema.parse(input),
    });
  } catch (error) {
    throw toSpanish(error, 'Credenciales inválidas');
  }
}

export async function register(input: RegisterInput): Promise<{ user: AuthUser }> {
  try {
    return await apiJson<{ user: AuthUser }>('/auth/register', {
      method: 'POST',
      // El backend ignora `role` (siempre MARKETING; el admin nace del seed).
      data: registerSchema.parse(input),
    });
  } catch (error) {
    throw toSpanish(error, 'Error al registrar el usuario');
  }
}

export async function getMe(): Promise<AuthUser> {
  try {
    // GET /auth/me devuelve el perfil (SafeUser: id, email, name, role).
    return await apiJson<AuthUser>('/auth/me');
  } catch (error) {
    throw toSpanish(error, 'Sesión inválida o expirada');
  }
}

/** Sesión de login de un dispositivo (GET /auth/sessions). */
export interface AuthSessionView {
  readonly id: string;
  readonly current: boolean;
  readonly persistent: boolean;
  readonly userAgent: string | null;
  readonly ip: string | null;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly expiresAt: string;
}

export async function listAuthSessions(): Promise<AuthSessionView[]> {
  try {
    return await apiJson<AuthSessionView[]>('/auth/sessions');
  } catch (error) {
    throw toSpanish(error, 'No se pudieron cargar las sesiones');
  }
}

/**
 * Revoca una sesión concreta. Si es la actual, el backend además borra las
 * cookies: el llamador debe limpiar el estado local y volver al login.
 */
export async function revokeAuthSession(sessionId: string): Promise<void> {
  try {
    await apiJson<void>(`/auth/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  } catch (error) {
    throw toSpanish(error, 'No se pudo cerrar la sesión');
  }
}

/** Cierra todas las sesiones del usuario menos la actual. */
export async function revokeOtherAuthSessions(): Promise<void> {
  try {
    await apiJson<void>('/auth/sessions/revoke-others', { method: 'POST' });
  } catch (error) {
    throw toSpanish(error, 'No se pudieron cerrar las otras sesiones');
  }
}

/**
 * Logout con revocación en servidor. Es best-effort: aunque la red falle, el
 * frontend limpia su estado local y el usuario vuelve al login.
 */
export async function logout(): Promise<void> {
  try {
    await apiJson<void>('/auth/logout', { method: 'POST' });
  } catch {
    // La sesión local se limpia igualmente en el llamador.
  }
}

function toSpanish(error: unknown, fallback: string): Error {
  if (error instanceof ApiError) {
    if (error.status === 401) return new Error('Credenciales inválidas');
    if (error.status === 409) return new Error('El correo ya está registrado');
    if (error.status === 400) return new Error('Datos inválidos');
    return new Error(fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}
