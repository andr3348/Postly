/**
 * Errores de dominio compartidos (vocabulario estándar del backend).
 * Los casos de uso los lanzan; `shared/filters.ts` los traduce a HTTP.
 * Nunca importar nada de `modules/` desde aquí.
 */
export class EmailAlreadyTakenError extends Error {
  constructor(email: string) {
    super(`Email already registered: ${email}`);
    this.name = 'EmailAlreadyTakenError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('Invalid or expired refresh token');
    this.name = 'InvalidRefreshTokenError';
  }
}

export class ForbiddenError extends Error {
  constructor(reason = 'Forbidden') {
    super(reason);
    this.name = 'ForbiddenError';
  }
}

export class PublicationNotFoundError extends Error {
  constructor(id: string) {
    super(`Publication with id ${id} not found`);
    this.name = 'PublicationNotFoundError';
  }
}

export class PublicationTargetNotFoundError extends Error {
  constructor(publicationId: string, platform: string) {
    super(`Target ${platform} not attached to publication ${publicationId}`);
    this.name = 'PublicationTargetNotFoundError';
  }
}

export class PublicationTargetAlreadyAttachedError extends Error {
  constructor(publicationId: string, platform: string) {
    super(`Target ${platform} already attached to publication ${publicationId}`);
    this.name = 'PublicationTargetAlreadyAttachedError';
  }
}

export class InvalidTargetFormatError extends Error {
  constructor(reason: string) {
    super(`Invalid target format: ${reason}`);
    this.name = 'InvalidTargetFormatError';
  }
}

export class PublicationWithoutTargetsError extends Error {
  constructor(id: string, action = 'submitted') {
    super(`Publication ${id} has no targets and cannot be ${action}`);
    this.name = 'PublicationWithoutTargetsError';
  }
}

export class TargetNotPublishedError extends Error {
  constructor(publicationId: string, platform: string) {
    super(`Target ${platform} of publication ${publicationId} is not published`);
    this.name = 'TargetNotPublishedError';
  }
}

export class InvalidPublicationTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition publication from ${from} to ${to}`);
    this.name = 'InvalidPublicationTransitionError';
  }
}

/** El reporte de n8n pertenece a un intento de despacho viejo. */
export class StaleDispatchAttemptError extends Error {
  constructor() {
    super('El reporte pertenece a un intento de despacho anterior. Actualiza el claim y vuelve a reportar.');
    this.name = 'StaleDispatchAttemptError';
  }
}

/** El target ya fue reportado con otro estado; no se sobrescribe. */
export class TargetAlreadyReportedError extends Error {
  constructor(targetId: string) {
    super(`El canal ${targetId} ya fue reportado con otro estado.`);
    this.name = 'TargetAlreadyReportedError';
  }
}

/** El reporte no trae los datos mínimos para un resultado seguro. */
export class InvalidTargetReportError extends Error {
  constructor(reason: string) {
    super(`Reporte de canal inválido: ${reason}`);
    this.name = 'InvalidTargetReportError';
  }
}

/** El reintento no es seguro o la publicación no está en un estado terminal. */
export class PublicationRetryNotAllowedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'PublicationRetryNotAllowedError';
  }
}

/** Se agotaron los reintentos manuales de un canal. */
export class RetryLimitExceededError extends Error {
  constructor(platform: string, max: number) {
    super(`El canal ${platform} agotó sus ${max} reintentos manuales.`);
    this.name = 'RetryLimitExceededError';
  }
}

/** Plataforma fuera del alcance de reintento de esta fase. */
export class UnsupportedRetryPlatformError extends Error {
  constructor(platform: string) {
    super(`El reintento no está disponible para ${platform}.`);
    this.name = 'UnsupportedRetryPlatformError';
  }
}

export class BrandNotFoundError extends Error {
  constructor(id: string) {
    super(`Brand with id ${id} not found`);
    this.name = 'BrandNotFoundError';
  }
}

export class MissingConnectedAccountError extends Error {
  constructor(brandId: string, missingPlatforms: string[]) {
    super(`Brand ${brandId} is missing connected accounts for: ${missingPlatforms.join(', ')}`);
    this.name = 'MissingConnectedAccountError';
  }
}

export class ConnectedAccountNotFoundError extends Error {
  constructor(brandId: string, platform: string) {
    super(`Brand ${brandId} has no connected account for ${platform}`);
    this.name = 'ConnectedAccountNotFoundError';
  }
}

export class InvalidAccountCredentialsError extends Error {
  constructor(platform: string, detail = 'Token rejected by provider') {
    super(`Account verification failed for ${platform}: ${detail}`);
    this.name = 'InvalidAccountCredentialsError';
  }
}

/**
 * Códigos del flujo OAuth de Meta. La UI los usa para guiar la conexión
 * (por ejemplo, `META_INSTAGRAM_NOT_LINKED` vs `META_PAGE_MISMATCH`).
 */
export type MetaOAuthErrorCode =
  | 'META_OAUTH_NOT_CONFIGURED'
  | 'META_OAUTH_INVALID_STATE'
  | 'META_OAUTH_SESSION_NOT_FOUND'
  | 'META_OAUTH_EXPIRED'
  | 'META_OAUTH_EXCHANGE_FAILED'
  | 'META_OAUTH_DENIED'
  | 'META_NO_PAGES'
  | 'META_PAGE_NOT_FOUND'
  | 'META_FACEBOOK_NOT_CONNECTED'
  | 'META_TOKEN_EXPIRED'
  | 'META_PAGE_MISMATCH'
  | 'META_INSTAGRAM_NOT_LINKED'
  | 'META_GRAPH_ERROR';

/**
 * Falla del flujo OAuth de Meta. A diferencia de los errores de dominio
 * clásicos, lleva `code` y `httpStatus` propios: el filtro los devuelve tal
 * cual para que el dashboard distinga la causa y muestre la guía correcta.
 */
export class MetaOAuthError extends Error {
  constructor(
    readonly code: MetaOAuthErrorCode,
    message: string,
    readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = 'MetaOAuthError';
  }
}

export type AiGenerationErrorCode =
  | 'GEMINI_NOT_CONFIGURED'
  | 'GEMINI_AUTH_FAILED'
  | 'GEMINI_MODEL_NOT_FOUND'
  | 'GEMINI_QUOTA_EXCEEDED'
  | 'GEMINI_OVERLOADED'
  | 'GEMINI_UNAVAILABLE'
  | 'GEMINI_TIMEOUT'
  | 'GEMINI_UNREACHABLE'
  | 'GEMINI_UPSTREAM_ERROR'
  | 'GEMINI_SAFETY_BLOCKED'
  | 'GEMINI_INVALID_RESPONSE'
  | 'GEMINI_UNKNOWN'
  | 'FAL_NOT_CONFIGURED'
  | 'FAL_AUTH_FAILED'
  | 'FAL_MODEL_NOT_FOUND'
  | 'FAL_QUOTA_EXCEEDED'
  | 'FAL_OVERLOADED'
  | 'FAL_UNAVAILABLE'
  | 'FAL_TIMEOUT'
  | 'FAL_UNREACHABLE'
  | 'FAL_UPSTREAM_ERROR'
  | 'FAL_REJECTED'
  | 'FAL_INVALID_RESPONSE'
  | 'FAL_UNKNOWN'
  | 'MEDIA_DOWNLOAD_FAILED'
  | 'R2_NOT_CONFIGURED'
  | 'R2_UPLOAD_FAILED'
  | 'R2_UNKNOWN';

/** Proveedor de la capa de IA que originó el error. */
export type AiGenerationProvider = 'GEMINI' | 'FAL' | 'R2';

export interface AiGenerationErrorOptions {
  readonly code: AiGenerationErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly model?: string | null;
  /** Default `GEMINI` (compatibilidad con los errores existentes). */
  readonly provider?: AiGenerationProvider;
}

/**
 * Error base de la capa de IA. El filtro HTTP usa estos metadatos para que el
 * frontend distinga causas y sepa si tiene sentido ofrecer "Reintentar".
 */
export class AiGenerationError extends Error {
  readonly code: AiGenerationErrorCode;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly model: string | null;
  readonly provider: AiGenerationProvider;

  constructor(
    options: AiGenerationErrorOptions & { readonly httpStatus: number },
  ) {
    super(options.message);
    this.name = 'AiGenerationError';
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.retryable = options.retryable;
    this.model = options.model ?? null;
    this.provider = options.provider ?? 'GEMINI';
  }
}

export class AiGenerationUnavailableError extends AiGenerationError {
  constructor(options: Omit<AiGenerationErrorOptions, 'httpStatus'> & {
    readonly httpStatus?: number;
  }) {
    super({ ...options, httpStatus: options.httpStatus ?? 503 });
    this.name = 'AiGenerationUnavailableError';
  }
}

export class AiGenerationInvalidResponseError extends AiGenerationError {
  constructor(options: Omit<AiGenerationErrorOptions, 'httpStatus'> & {
    readonly httpStatus?: number;
  }) {
    super({ ...options, httpStatus: options.httpStatus ?? 502 });
    this.name = 'AiGenerationInvalidResponseError';
  }
}

export class AiGenerationRejectedError extends AiGenerationError {
  constructor(options: Omit<AiGenerationErrorOptions, 'httpStatus'> & {
    readonly httpStatus?: number;
  }) {
    super({ ...options, httpStatus: options.httpStatus ?? 422 });
    this.name = 'AiGenerationRejectedError';
  }
}
