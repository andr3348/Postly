import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

/**
 * Cliente HTTP base del frontend (axios). Todas las llamadas a la API (vía
 * el rewrite `/api/*` de `next.config.ts`, mismo origen: sin CORS) pasan por
 * aquí para heredar credenciales + rotación silenciosa.
 */
export interface ApiErrorMetadata {
  readonly code?: string | null;
  readonly retryable?: boolean | null;
  readonly model?: string | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly retryable: boolean | null;
  readonly model: string | null;

  constructor(status: number, message: string, metadata: ApiErrorMetadata = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = metadata.code ?? null;
    this.retryable = metadata.retryable ?? null;
    this.model = metadata.model ?? null;
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
    const payload = readErrorPayload(error, status);
    return new ApiError(status, payload.message, payload);
  }
  return error instanceof Error ? error : new Error('Error inesperado del servidor');
}

interface ParsedErrorPayload extends ApiErrorMetadata {
  readonly message: string;
}

function readErrorPayload(error: AxiosError, status: number): ParsedErrorPayload {
  const data: unknown = error.response?.data;
  const record =
    typeof data === 'object' && data !== null
      ? (data as Record<string, unknown>)
      : null;
  const message: unknown = record?.message;
  return {
    message:
      typeof message === 'string' && message !== ''
        ? message
        : defaultMessage(status),
    code: typeof record?.code === 'string' ? record.code : null,
    retryable:
      typeof record?.retryable === 'boolean' ? record.retryable : null,
    model: typeof record?.model === 'string' ? record.model : null,
  };
}

function defaultMessage(status: number): string {
  if (status === 0) return 'No pudimos conectar con el servidor. Revisa la conexión y vuelve a intentarlo.';
  if (status === 401) return 'Sesión inválida o expirada';
  if (status === 403) return 'Sin permisos para esta acción';
  if (status === 404) return 'Recurso no encontrado';
  if (status === 409) return 'El recurso ya existe';
  if (status === 429) return 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
  if (status === 502) return 'El servicio externo devolvió una respuesta inválida.';
  if (status === 503) return 'Servicio no disponible temporalmente.';
  if (status === 504) return 'El servicio tardó demasiado en responder.';
  return 'Error inesperado del servidor';
}
