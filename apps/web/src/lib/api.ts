import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

/**
 * Cliente HTTP base del frontend (axios). Todas las llamadas a la API (vía
 * el rewrite `/api/*` de `next.config.ts`, mismo origen: sin CORS) pasan por
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

interface RetriableConfig extends AxiosRequestConfig {
  _retried?: boolean;
}

const client = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Refresh-on-401: ante 401 intenta `POST /auth/refresh` (la cookie viaja
 * sola) y reintenta UNA vez. Sin bucles: el refresh nunca se reintenta.
 */
client.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!(error instanceof AxiosError) || error.response?.status !== 401) {
      throw error;
    }
    const original = error.config as RetriableConfig | undefined;
    if (original === undefined || original._retried === true || original.url === '/auth/refresh') {
      throw error;
    }
    try {
      await client.post('/auth/refresh');
    } catch {
      throw error;
    }
    const retry: RetriableConfig = { ...original, _retried: true };
    return client.request(retry);
  },
);

/** Llamada JSON tipada: traduce fallos a `ApiError` con mensaje útil. */
export async function apiJson<T>(path: string, init?: AxiosRequestConfig): Promise<T> {
  try {
    const response = await client.request<T>({ url: path, ...init });
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}

function toApiError(error: unknown): Error {
  if (error instanceof AxiosError) {
    const status = error.response?.status ?? 0;
    return new ApiError(status, readMessage(error, status));
  }
  return error instanceof Error ? error : new Error('Error inesperado del servidor');
}

function readMessage(error: AxiosError, status: number): string {
  const data: unknown = error.response?.data;
  if (typeof data === 'object' && data !== null && 'message' in data) {
    const message: unknown = (data as { message: unknown }).message;
    if (typeof message === 'string' && message !== '') {
      return message;
    }
  }
  return defaultMessage(status);
}

function defaultMessage(status: number): string {
  if (status === 401) return 'Sesión inválida o expirada';
  if (status === 403) return 'Sin permisos para esta acción';
  if (status === 404) return 'Recurso no encontrado';
  if (status === 409) return 'El recurso ya existe';
  return 'Error inesperado del servidor';
}
