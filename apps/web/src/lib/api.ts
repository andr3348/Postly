/**
 * Cliente HTTP base del frontend. Todas las llamadas a la API (vía el
 * rewrite `/api/*` de `next.config.ts`, mismo origen: sin CORS) pasan por
 * aquí para heredar credenciales + rotación silenciosa.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * `fetch` con cookies y refresh-on-401: ante 401 intenta
 * `POST /auth/refresh` (la cookie viaja sola) y reintenta UNA vez.
 * Si el refresh falla, devuelve el 401 original.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, { ...init, credentials: 'include' });
  if (response.status !== 401 || path === '/api/auth/refresh') {
    return response;
  }
  const refreshed = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });
  if (!refreshed.ok) {
    return response;
  }
  return fetch(path, { ...init, credentials: 'include' });
}

/** POST/GET JSON tipado: traduce errores HTTP a `ApiError` con mensaje útil. */
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    throw new ApiError(response.status, await readMessage(response));
  }
  return response.json() as Promise<T>;
}

async function readMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const message: unknown = (body as { message: unknown }).message;
      if (typeof message === 'string' && message !== '') {
        return message;
      }
    }
  } catch {
    // Cuerpo no-JSON (p. ej. 500 del proxy): cae al mensaje por defecto.
  }
  return defaultMessage(response.status);
}

function defaultMessage(status: number): string {
  if (status === 401) return 'Sesión inválida o expirada';
  if (status === 403) return 'Sin permisos para esta acción';
  if (status === 404) return 'Recurso no encontrado';
  if (status === 409) return 'El recurso ya existe';
  return 'Error inesperado del servidor';
}
