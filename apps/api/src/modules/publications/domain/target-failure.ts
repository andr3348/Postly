import type {
  FailureKind,
  FailureStage,
  PublicationTarget,
  TargetFailure,
} from './target.entity.js';

/** Error estructurado opcional que puede enviar n8n en el reporte. */
export interface ReportProviderError {
  readonly code?: number;
  readonly subcode?: number;
  readonly message?: string;
  readonly type?: string;
  readonly isTransient?: boolean;
  readonly httpStatus?: number;
  readonly traceId?: string;
  readonly retryAfterSeconds?: number;
}

export interface ClassifyTargetFailureInput {
  readonly stage?: FailureStage;
  readonly errorMessage?: string | null;
  readonly error?: ReportProviderError | null;
}

interface ParsedProviderError {
  readonly code: number | null;
  readonly subcode: number | null;
  readonly message: string | null;
  readonly type: string | null;
  readonly isTransient: boolean | null;
  readonly httpStatus: number | null;
  readonly traceId: string | null;
  readonly retryAfterSeconds: number | null;
}

const AUTH_CODES = new Set([102, 190]);
const AUTH_SUBCODES = new Set([458, 459, 460, 463, 464, 467, 492]);
const PERMISSION_CODES = new Set([10, 1363042, 1363005]);
const RATE_LIMIT_CODES = new Set([4, 17, 32, 341, 613, 80001, 80002, 2207042]);
const TRANSIENT_CODES = new Set([
  6000, 1363019, 1363021, 1363030, 1363033, 1363037, 1363041, 1363045,
  2207001, 2207032, 2207053, 2207020, 2207008, 2207027, 9007,
]);
const MEDIA_FETCH_CODES = new Set([2207003, 2207052, 9004]);
const MEDIA_CONFIG_SUBCODES = new Set([2069019]);
const UNSUPPORTED_MEDIA_TYPE_SUBCODES = new Set([2207067]);
const INVALID_CONTENT_CODES = new Set([
  2207004, 2207005, 2207009, 2207010, 2207026,
  1363022, 1363023, 1363024, 1363025, 1363026,
  1363040, 1363127, 1363128, 1363129,
]);
const ACCOUNT_CODES = new Set([2207050, 2207051]);
const NETWORK_ERROR_PATTERN =
  /timeout|timed out|econnreset|econnrefused|etimedout|enotfound|socket hang up|network error|fetch failed/i;

/**
 * Clasifica un fallo de Meta con precedencia subcode → code → HTTP/transient.
 * Regla de oro: un 5xx/timeout en PUBLISH sin código del proveedor es
 * `UNKNOWN_OUTCOME`; nunca se ofrece reintento porque el post pudo crearse.
 */
export function classifyTargetFailure(input: ClassifyTargetFailureInput): TargetFailure {
  const parsed = parseProviderError(input.errorMessage ?? '');
  const code = input.error?.code ?? parsed.code;
  const subcode = input.error?.subcode ?? parsed.subcode;
  const httpStatus = input.error?.httpStatus ?? parsed.httpStatus;
  const type = input.error?.type ?? parsed.type;
  const isTransient = input.error?.isTransient ?? parsed.isTransient;
  const traceId = input.error?.traceId ?? parsed.traceId;
  const retryAfterSeconds = input.error?.retryAfterSeconds ?? parsed.retryAfterSeconds;
  const providerMessage =
    normalizeProviderMessage(input.error?.message ?? parsed.message) ??
    normalizeProviderMessage(input.errorMessage);
  const stage = input.stage ?? 'PUBLISH';
  const base = { stage, code, subcode, httpStatus, type, isTransient, providerMessage, traceId, retryAfterSeconds };

  if (subcode !== null && AUTH_SUBCODES.has(subcode)) {
    return failure(base, 'AUTH', false, true, {
      message: 'La red social rechazó el token de acceso de la cuenta.',
      action: 'Vuelve a conectar la cuenta con un token válido y verifica que la página siga vinculada.',
    });
  }
  if (subcode !== null && MEDIA_CONFIG_SUBCODES.has(subcode)) {
    return failure(base, 'MEDIA', true, true, {
      message: 'Meta no pudo leer la imagen del post.',
      action: 'Verifica que la URL de la imagen sea pública y vuelve a intentarlo.',
    });
  }
  if (subcode !== null && UNSUPPORTED_MEDIA_TYPE_SUBCODES.has(subcode)) {
    return failure(base, 'MEDIA', true, true, {
      message: 'Meta rechazó el tipo de multimedia del post.',
      action: 'Corrige el flujo para publicar el video como REELS y vuelve a intentarlo.',
    });
  }
  if (code !== null && AUTH_CODES.has(code)) {
    return failure(base, 'AUTH', false, true, {
      message: 'La red social rechazó el token de acceso de la cuenta.',
      action: 'Vuelve a conectar la cuenta con un token válido y verifica que la página siga vinculada.',
    });
  }
  if (
    code !== null &&
    (PERMISSION_CODES.has(code) || (code >= 200 && code <= 299))
  ) {
    return failure(base, 'PERMISSION', false, true, {
      message: 'La cuenta no tiene permiso para publicar este contenido.',
      action: 'Revisa los permisos de la cuenta y de la página en Meta.',
    });
  }
  if (code !== null && RATE_LIMIT_CODES.has(code)) {
    return failure(base, 'RATE_LIMIT', true, false, {
      message: 'Meta limitó temporalmente las publicaciones.',
      action: 'Espera unos minutos y vuelve a intentarlo.',
    });
  }
  if (
    code !== null &&
    (TRANSIENT_CODES.has(code) || (subcode !== null && TRANSIENT_CODES.has(subcode)))
  ) {
    return failure(base, 'TRANSIENT', true, false, {
      message:
        code === 9007 || subcode === 9007
          ? 'El video todavía se está procesando en Meta.'
          : 'Meta no pudo completar la publicación por un problema temporal.',
      action:
        code === 9007 || subcode === 9007
          ? 'Espera un minuto y vuelve a intentarlo.'
          : 'Espera un momento y vuelve a intentarlo.',
    });
  }
  if (code !== null && MEDIA_FETCH_CODES.has(code)) {
    return failure(base, 'MEDIA', true, true, {
      message: 'Meta no pudo descargar el archivo del post.',
      action: 'Verifica que la URL del archivo sea pública y vuelve a intentarlo.',
    });
  }
  if (code === 324) {
    return failure(base, 'MEDIA', true, true, {
      message: 'Meta no pudo leer el archivo del post.',
      action: 'Verifica que la URL del archivo sea pública y vuelve a intentarlo.',
    });
  }
  if (code !== null && INVALID_CONTENT_CODES.has(code)) {
    return failure(base, 'CONTENT', false, true, {
      message: 'Meta rechazó el contenido o el formato del archivo.',
      action: 'Corrige el formato, la duración o la URL del archivo y crea una nueva publicación.',
    });
  }
  if (code !== null && ACCOUNT_CODES.has(code)) {
    return failure(base, 'ACCOUNT', false, true, {
      message: 'La cuenta de la red social no está disponible para publicar.',
      action: 'Vuelve a conectar la cuenta y verifica su estado en Meta.',
    });
  }

  if (httpStatus === 401) {
    return failure(base, 'AUTH', false, true, {
      message: 'La red social rechazó el token de acceso de la cuenta.',
      action: 'Vuelve a conectar la cuenta con un token válido y verifica que la página siga vinculada.',
    });
  }
  if (httpStatus === 403) {
    return failure(base, 'PERMISSION', false, true, {
      message: 'La cuenta no tiene permiso para publicar este contenido.',
      action: 'Revisa los permisos de la cuenta y de la página en Meta.',
    });
  }
  if (httpStatus === 429) {
    return failure(base, 'RATE_LIMIT', true, false, {
      message: 'Meta limitó temporalmente las publicaciones.',
      action: 'Espera unos minutos y vuelve a intentarlo.',
    });
  }

  const networkError =
    NETWORK_ERROR_PATTERN.test(input.errorMessage ?? '') ||
    NETWORK_ERROR_PATTERN.test(input.error?.message ?? '');
  const transientish = isTransient === true || networkError || (httpStatus !== null && httpStatus >= 500);

  if (transientish && stage === 'PUBLISH' && code === null) {
    return failure(base, 'UNKNOWN_OUTCOME', false, true, {
      message: 'No sabemos si la publicación llegó a crearse en la red social.',
      action:
        'Revísalo en la red social antes de volver a publicar. Si no existe, crea una nueva publicación.',
    });
  }
  if (transientish) {
    return failure(base, 'TRANSIENT', true, false, {
      message: 'Meta no pudo completar la publicación por un problema temporal.',
      action: 'Espera un momento y vuelve a intentarlo.',
    });
  }

  if (code !== null || (httpStatus !== null && httpStatus >= 400 && httpStatus < 500)) {
    return failure(base, 'PROVIDER_REJECTED', true, true, {
      message: 'Meta rechazó la solicitud antes de crear la publicación.',
      action: 'Revisa el detalle técnico, corrige el dato rechazado y vuelve a intentarlo.',
    });
  }

  if (stage === 'PUBLISH') {
    return failure(base, 'UNKNOWN_OUTCOME', false, true, {
      message: 'No sabemos si la publicación llegó a crearse en la red social.',
      action:
        'Revísalo en la red social antes de volver a publicar. Si no existe, crea una nueva publicación.',
    });
  }

  return failure(base, 'UNKNOWN', true, false, {
    message: 'Ocurrió un error desconocido durante la preparación del archivo.',
    action: 'Espera un momento y vuelve a intentarlo.',
  });
}

/** Fallo histórico sin JSON: se clasifica con la etapa conservadora PUBLISH. */
export function resolveTargetFailure(target: PublicationTarget): TargetFailure | null {
  if (target.failure !== null) {
    return target.failure;
  }
  if (target.status !== 'FAILED' || target.errorMessage === null) {
    return null;
  }
  return classifyTargetFailure({ stage: 'PUBLISH', errorMessage: target.errorMessage });
}

/** Fallo del watchdog: el resultado real en la red social es desconocido. */
export function staleDispatchFailure(): TargetFailure {
  return {
    kind: 'UNKNOWN_OUTCOME',
    stage: 'PUBLISH',
    retryable: false,
    requiresAction: true,
    code: null,
    subcode: null,
    httpStatus: null,
    type: null,
    isTransient: null,
    message: 'El despacho se venció antes de recibir el reporte de n8n.',
    action:
      'Revisa en la red social si el post se creó. Si no existe, crea una nueva publicación.',
    providerMessage: 'Despacho vencido: n8n no reportó dentro del lease.',
    traceId: null,
    retryAfterSeconds: null,
  };
}

function failure(
  base: Omit<TargetFailure, 'kind' | 'retryable' | 'requiresAction' | 'message' | 'action'>,
  kind: FailureKind,
  retryable: boolean,
  requiresAction: boolean,
  copy: { readonly message: string; readonly action: string },
): TargetFailure {
  return {
    ...base,
    kind,
    retryable,
    requiresAction,
    message: copy.message,
    action: copy.action,
  };
}

function parseProviderError(raw: string): ParsedProviderError {
  const trimmed = raw.trim();
  const httpFromPrefix = /^(\d{3})\s*[-:]/.exec(trimmed);
  const parsed = parseErrorJson(trimmed);
  const root = isRecord(parsed) ? parsed : null;
  const error = root !== null && isRecord(root['error']) ? root['error'] : root;

  const code = asNumber(error?.['code']);
  const subcode = asNumber(error?.['error_subcode'] ?? error?.['errorSubcode'] ?? error?.['subcode']);
  const message = asString(error?.['message']);
  const userMessage = asString(error?.['error_user_msg'] ?? error?.['errorUserMsg']);
  const type = asString(error?.['type']);
  const isTransient = asBoolean(error?.['is_transient'] ?? error?.['isTransient']);
  const traceId = asString(error?.['fbtrace_id'] ?? error?.['trace_id'] ?? error?.['traceId']);
  const retryAfter = asNumber(error?.['retry_after'] ?? error?.['retryAfterSeconds']);
  const providerMessage =
    message !== null && userMessage !== null && userMessage !== message
      ? `${message} — ${userMessage}`
      : (message ?? userMessage);

  return {
    code,
    subcode,
    message: providerMessage,
    type,
    isTransient,
    httpStatus: httpFromPrefix !== null ? Number(httpFromPrefix[1]) : asNumber(root?.['httpStatus']),
    traceId,
    retryAfterSeconds: retryAfter,
  };
}

function parseErrorJson(raw: string): unknown {
  const direct = tryJson(raw);
  if (direct !== undefined) {
    return direct;
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  return tryJson(raw.slice(start, end + 1)) ?? null;
}

function tryJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function normalizeProviderMessage(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.slice(0, 4000);
}
