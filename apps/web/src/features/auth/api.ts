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
    return await apiJson<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(loginSchema.parse(input)),
    });
  } catch (error) {
    throw toSpanish(error, 'Credenciales inválidas');
  }
}

export async function register(input: RegisterInput): Promise<{ user: AuthUser }> {
  try {
    return await apiJson<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      // El backend ignora `role` (siempre MARKETING; el admin nace del seed).
      body: JSON.stringify(registerSchema.parse(input)),
    });
  } catch (error) {
    throw toSpanish(error, 'Error al registrar el usuario');
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
