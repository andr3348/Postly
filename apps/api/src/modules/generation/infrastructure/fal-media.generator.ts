import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiGenerationError,
  AiGenerationInvalidResponseError,
  AiGenerationRejectedError,
  AiGenerationUnavailableError,
} from '../../../shared/errors.js';
import type { GenerationMediaType } from '../domain/generated-content.entity.js';
import type {
  GeneratedMedia,
  MediaGenerationInput,
  MediaGenerator,
} from '../domain/ports/media-generator.port.js';

const FAL_QUEUE_BASE_URL = 'https://queue.fal.run';
const DEFAULT_IMAGE_MODEL = 'fal-ai/flux/schnell';
const DEFAULT_VIDEO_MODEL =
  'fal-ai/kling-video/v3/turbo/standard/text-to-video';
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 600_000;
const REQUEST_TIMEOUT_MS = 30_000;

type FalFailureKind = 'http' | 'timeout' | 'network';

class FalHttpError extends Error {
  constructor(
    readonly kind: FalFailureKind,
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'FalHttpError';
  }
}

interface FalSubmitBody {
  readonly request_id?: unknown;
  readonly status_url?: unknown;
  readonly response_url?: unknown;
}

interface FalStatusBody {
  readonly status?: unknown;
}

interface FalMediaOutput {
  readonly images?: readonly {
    readonly url?: unknown;
    readonly content_type?: unknown;
  }[];
  readonly video?: {
    readonly url?: unknown;
    readonly content_type?: unknown;
  };
}

export interface FalMediaGeneratorHooks {
  /** `fetch` inyectable para tests. */
  readonly fetchFn?: typeof fetch;
  /** Espera entre polls, inyectable para tests. */
  readonly sleepFn?: (ms: number) => Promise<void>;
}

/**
 * Adaptador de fal.ai con su API de cola (`queue.fal.run`): encola el job,
 * consulta el estado hasta `COMPLETED` y recién ahí lee el resultado. La cola
 * evita mantener un socket abierto durante minutos con modelos de video.
 *
 * Los payloads son "best effort" para los modelos por defecto (FLUX schnell
 * para imagen, Kling 3.0 Turbo para video); se ajustan al probar con una
 * `FAL_KEY` real. El timeout por defecto (10 min) cubre la cola de video.
 */
export class FalMediaGenerator implements MediaGenerator {
  private readonly logger = new Logger(FalMediaGenerator.name);
  private readonly apiKey: string | undefined;
  private readonly imageModel: string;
  private readonly videoModel: string;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(config: ConfigService, hooks: FalMediaGeneratorHooks = {}) {
    this.apiKey = config.get<string>('FAL_KEY')?.trim() || undefined;
    this.imageModel =
      config.get<string>('FAL_IMAGE_MODEL')?.trim() || DEFAULT_IMAGE_MODEL;
    this.videoModel =
      config.get<string>('FAL_VIDEO_MODEL')?.trim() || DEFAULT_VIDEO_MODEL;
    this.pollIntervalMs = toPositiveInt(
      config.get<string>('FAL_POLL_INTERVAL_MS'),
      DEFAULT_POLL_INTERVAL_MS,
    );
    this.timeoutMs = toPositiveInt(
      config.get<string>('FAL_TIMEOUT_MS'),
      DEFAULT_TIMEOUT_MS,
    );
    this.fetchFn = hooks.fetchFn ?? fetch;
    this.sleepFn =
      hooks.sleepFn ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async generate(input: MediaGenerationInput): Promise<GeneratedMedia> {
    if (this.apiKey === undefined) {
      this.logger.error('FAL_KEY no está configurada');
      throw new AiGenerationUnavailableError({
        code: 'FAL_NOT_CONFIGURED',
        provider: 'FAL',
        message:
          'La generación de media no está configurada. Avisa al administrador.',
        retryable: false,
      });
    }

    const model =
      input.mediaType === 'VIDEO' ? this.videoModel : this.imageModel;

    try {
      const job = await this.submit(model, input);
      await this.waitUntilCompleted(job.statusUrl, model);
      const output = await this.fetchJson(job.responseUrl, model);
      return extractMedia(output, model, input.mediaType);
    } catch (error) {
      this.logFailure(model, error);
      throw toDomainError(error, model);
    }
  }

  private async submit(
    model: string,
    input: MediaGenerationInput,
  ): Promise<{ readonly statusUrl: string; readonly responseUrl: string }> {
    const body = buildRequestBody(input);
    const response = await this.request(`${FAL_QUEUE_BASE_URL}/${model}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const parsed = (await this.parseJson(
      response,
      model,
    )) as FalSubmitBody | null;

    const requestId =
      typeof parsed?.request_id === 'string' ? parsed.request_id : null;
    const statusUrl =
      typeof parsed?.status_url === 'string'
        ? parsed.status_url
        : requestId === null
          ? null
          : `${FAL_QUEUE_BASE_URL}/${model}/requests/${requestId}/status`;
    const responseUrl =
      typeof parsed?.response_url === 'string'
        ? parsed.response_url
        : requestId === null
          ? null
          : `${FAL_QUEUE_BASE_URL}/${model}/requests/${requestId}`;

    if (statusUrl === null || responseUrl === null) {
      throw new AiGenerationInvalidResponseError({
        code: 'FAL_INVALID_RESPONSE',
        provider: 'FAL',
        message: 'fal.ai no devolvió la URL de seguimiento del job.',
        retryable: true,
        model,
      });
    }

    return { statusUrl, responseUrl };
  }

  private async waitUntilCompleted(
    statusUrl: string,
    model: string,
  ): Promise<void> {
    const deadline = Date.now() + this.timeoutMs;

    while (Date.now() < deadline) {
      const response = await this.request(statusUrl, { method: 'GET' });
      const parsed = (await this.parseJson(
        response,
        model,
      )) as FalStatusBody | null;
      const status = parsed?.status;

      if (status === 'COMPLETED') {
        return;
      }
      if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED') {
        throw new AiGenerationRejectedError({
          code: 'FAL_REJECTED',
          provider: 'FAL',
          message:
            'fal.ai no pudo completar la generación (¿contenido no permitido?). Ajusta el brief e inténtalo de nuevo.',
          retryable: false,
          model,
        });
      }
      if (status !== 'IN_QUEUE' && status !== 'IN_PROGRESS') {
        throw new AiGenerationInvalidResponseError({
          code: 'FAL_INVALID_RESPONSE',
          provider: 'FAL',
          message: 'fal.ai devolvió un estado inesperado.',
          retryable: true,
          model,
        });
      }

      await this.sleepFn(this.pollIntervalMs);
    }

    throw new AiGenerationUnavailableError({
      code: 'FAL_TIMEOUT',
      provider: 'FAL',
      httpStatus: 504,
      message:
        'fal.ai tardó demasiado en generar la media. Vuelve a intentarlo.',
      retryable: true,
      model,
    });
  }

  private async fetchJson(url: string, model: string): Promise<unknown> {
    const response = await this.request(url, { method: 'GET' });
    return this.parseJson(response, model);
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${this.apiKey ?? ''}`,
          ...init.headers,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new FalHttpError(
          'timeout',
          null,
          'fal.ai agotó el tiempo de espera',
        );
      }
      throw new FalHttpError(
        'network',
        null,
        'No se pudo conectar con fal.ai',
      );
    }

    if (!response.ok) {
      const detail = await readErrorMessage(response);
      throw new FalHttpError(
        'http',
        response.status,
        detail ?? `fal.ai respondió HTTP ${response.status}`,
      );
    }

    return response;
  }

  private async parseJson(response: Response, model: string): Promise<unknown> {
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new AiGenerationInvalidResponseError({
        code: 'FAL_INVALID_RESPONSE',
        provider: 'FAL',
        message: 'fal.ai devolvió una respuesta que no se pudo leer.',
        retryable: true,
        model,
      });
    }
  }

  private logFailure(model: string, error: unknown): void {
    if (error instanceof FalHttpError) {
      const detail = error.message.replace(/\s+/g, ' ').slice(0, 300);
      this.logger.error(
        `fal.ai ${model} (${error.kind} ${error.status ?? 'n/a'}): ${detail}`,
      );
      return;
    }
    if (error instanceof AiGenerationError) {
      this.logger.error(`fal.ai ${model}: ${error.code}`);
      return;
    }
    this.logger.error(`fal.ai ${model}: error inesperado`);
  }
}

function buildRequestBody(input: MediaGenerationInput): Record<string, unknown> {
  if (input.mediaType === 'VIDEO') {
    return {
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio,
      duration: '5',
    };
  }

  return {
    prompt: input.prompt,
    image_size: input.aspectRatio === '9:16' ? 'portrait_16_9' : 'square_hd',
  };
}

function extractMedia(
  output: unknown,
  model: string,
  mediaType: GenerationMediaType,
): GeneratedMedia {
  const invalid = (): Error =>
    new AiGenerationInvalidResponseError({
      code: 'FAL_INVALID_RESPONSE',
      provider: 'FAL',
      message: 'fal.ai no devolvió la media esperada. Vuelve a intentarlo.',
      retryable: true,
      model,
    });

  if (mediaType === 'VIDEO') {
    const video = (output as FalMediaOutput | null)?.video;
    if (typeof video?.url !== 'string' || video.url === '') {
      throw invalid();
    }
    return {
      url: video.url,
      model,
      contentType: readContentType(video.content_type) ?? 'video/mp4',
    };
  }

  const image = (output as FalMediaOutput | null)?.images?.[0];
  if (typeof image?.url !== 'string' || image.url === '') {
    throw invalid();
  }
  return {
    url: image.url,
    model,
    contentType: readContentType(image.content_type) ?? 'image/jpeg',
  };
}

function readContentType(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim().toLowerCase()
    : null;
}

function toDomainError(error: unknown, model: string): AiGenerationError {
  if (error instanceof AiGenerationError) {
    return error;
  }
  if (error instanceof FalHttpError) {
    return mapFalError(error, model);
  }
  return new AiGenerationUnavailableError({
    code: 'FAL_UNKNOWN',
    provider: 'FAL',
    message: 'Ocurrió un error inesperado con fal.ai. Vuelve a intentarlo.',
    retryable: true,
    model,
  });
}

function mapFalError(error: FalHttpError, model: string): AiGenerationError {
  if (error.kind === 'timeout') {
    return new AiGenerationUnavailableError({
      code: 'FAL_TIMEOUT',
      provider: 'FAL',
      httpStatus: 504,
      message: 'fal.ai tardó demasiado en responder. Vuelve a intentarlo.',
      retryable: true,
      model,
    });
  }
  if (error.kind === 'network') {
    return new AiGenerationUnavailableError({
      code: 'FAL_UNREACHABLE',
      provider: 'FAL',
      message: 'No se pudo conectar con fal.ai. Vuelve a intentarlo.',
      retryable: true,
      model,
    });
  }

  if (error.status === 401 || error.status === 403) {
    return new AiGenerationUnavailableError({
      code: 'FAL_AUTH_FAILED',
      provider: 'FAL',
      message:
        'fal.ai rechazó la credencial configurada. Avisa al administrador.',
      retryable: false,
      model,
    });
  }
  if (error.status === 404) {
    return new AiGenerationUnavailableError({
      code: 'FAL_MODEL_NOT_FOUND',
      provider: 'FAL',
      message:
        'El modelo de fal.ai configurado no existe o no está disponible.',
      retryable: false,
      model,
    });
  }
  if (error.status === 429) {
    return new AiGenerationUnavailableError({
      code: 'FAL_QUOTA_EXCEEDED',
      provider: 'FAL',
      httpStatus: 429,
      message:
        'fal.ai agotó la cuota disponible. Espera un momento y vuelve a intentarlo.',
      retryable: true,
      model,
    });
  }
  if (error.status === 503) {
    return new AiGenerationUnavailableError({
      code: 'FAL_OVERLOADED',
      provider: 'FAL',
      message:
        'fal.ai está saturado por alta demanda. Espera un minuto y vuelve a intentarlo.',
      retryable: true,
      model,
    });
  }
  if (error.status === 500 || error.status === 502 || error.status === 504) {
    return new AiGenerationUnavailableError({
      code: 'FAL_UPSTREAM_ERROR',
      provider: 'FAL',
      httpStatus: 502,
      message: 'fal.ai devolvió un error temporal. Vuelve a intentarlo.',
      retryable: true,
      model,
    });
  }

  return new AiGenerationUnavailableError({
    code: 'FAL_UNKNOWN',
    provider: 'FAL',
    message: 'Ocurrió un error inesperado con fal.ai. Vuelve a intentarlo.',
    retryable: true,
    model,
  });
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as {
      readonly detail?: unknown;
      readonly message?: unknown;
      readonly error?: unknown;
    };
    if (typeof body.detail === 'string') {
      return body.detail;
    }
    if (typeof body.message === 'string') {
      return body.message;
    }
    if (typeof body.error === 'string') {
      return body.error;
    }
    return null;
  } catch {
    return null;
  }
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
