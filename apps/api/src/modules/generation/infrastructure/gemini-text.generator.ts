import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiGenerationError,
  AiGenerationInvalidResponseError,
  AiGenerationRejectedError,
  AiGenerationUnavailableError,
} from '../../../shared/errors.js';
import type { GenerationMode } from '../domain/generated-content.entity.js';
import type {
  LlmTextGenerator,
  LlmTextGeneratorInput,
  LlmTextGeneratorResult,
} from '../domain/ports/llm-text-generator.port.js';

const GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 20_000;
const MAX_OUTPUT_TOKENS = 4096;
const RETRYABLE_STATUSES = new Set([404, 429, 500, 502, 503, 504]);

interface GeminiPart {
  readonly text?: unknown;
}

interface GeminiCandidate {
  readonly content?: { readonly parts?: readonly GeminiPart[] };
  readonly finishReason?: unknown;
}

interface GeminiResponseBody {
  readonly candidates?: readonly GeminiCandidate[];
  readonly promptFeedback?: { readonly blockReason?: unknown };
  readonly usageMetadata?: { readonly totalTokenCount?: unknown };
  readonly error?: {
    readonly code?: unknown;
    readonly status?: unknown;
    readonly message?: unknown;
  };
}

type GeminiFailureKind = 'http' | 'timeout' | 'network';

class GeminiHttpError extends Error {
  constructor(
    readonly kind: GeminiFailureKind,
    readonly status: number | null,
    message: string,
    readonly upstreamStatus?: string,
  ) {
    super(message);
    this.name = 'GeminiHttpError';
  }
}

/**
 * Adaptador HTTP de Gemini. No usa SDK para mantener el borde pequeño y
 * testeable con `fetch` mockeado. La API key se envía en header, nunca en query.
 */
@Injectable()
export class GeminiTextGenerator implements LlmTextGenerator {
  private readonly logger = new Logger(GeminiTextGenerator.name);
  private readonly apiKey: string | undefined;
  private readonly primaryModel: string;
  private readonly fallbackModel: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GEMINI_API_KEY')?.trim() || undefined;
    this.primaryModel =
      config.get<string>('GEMINI_TEXT_MODEL')?.trim() || 'gemini-3.8-flash';
    this.fallbackModel =
      config.get<string>('GEMINI_TEXT_FALLBACK_MODEL')?.trim() ||
      'gemini-3.5-flash-lite';
  }

  async generate(
    input: LlmTextGeneratorInput,
  ): Promise<LlmTextGeneratorResult> {
    if (this.apiKey === undefined) {
      this.logger.error('GEMINI_API_KEY no está configurada');
      throw new AiGenerationUnavailableError({
        code: 'GEMINI_NOT_CONFIGURED',
        message:
          'El asistente de IA no está configurado. Avisa al administrador.',
        retryable: false,
      });
    }

    try {
      return await this.generateWithModel(this.primaryModel, input);
    } catch (error) {
      this.logFailure(this.primaryModel, error, 'warn');
      if (!isRetryable(error) || this.fallbackModel === this.primaryModel) {
        throw toDomainError(error, this.primaryModel);
      }
      this.logger.warn(
        `Reintentando con el modelo de respaldo ${this.fallbackModel}`,
      );
    }

    try {
      return await this.generateWithModel(this.fallbackModel, input);
    } catch (error) {
      this.logFailure(this.fallbackModel, error, 'error');
      throw toDomainError(error, this.fallbackModel);
    }
  }

  private async generateWithModel(
    model: string,
    input: LlmTextGeneratorInput,
  ): Promise<LlmTextGeneratorResult> {
    const url = `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`;
    const body = {
      systemInstruction: { parts: [{ text: input.systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: buildResponseSchema(input.mode),
        thinkingConfig: { thinkingLevel: 'low' },
      },
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey ?? '',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new GeminiHttpError(
          'timeout',
          null,
          'Gemini agotó el tiempo de espera',
        );
      }
      throw new GeminiHttpError(
        'network',
        null,
        'No se pudo conectar con Gemini',
      );
    }

    const responseBody = (await response
      .json()
      .catch(() => null)) as GeminiResponseBody | null;

    if (!response.ok) {
      throw new GeminiHttpError(
        'http',
        response.status,
        typeof responseBody?.error?.message === 'string'
          ? responseBody.error.message
          : `Gemini respondió HTTP ${response.status}`,
        typeof responseBody?.error?.status === 'string'
          ? responseBody.error.status
          : undefined,
      );
    }

    if (responseBody === null) {
      throw new AiGenerationInvalidResponseError({
        code: 'GEMINI_INVALID_RESPONSE',
        message:
          'Gemini devolvió una respuesta vacía. Vuelve a intentarlo.',
        retryable: true,
        model,
      });
    }

    if (responseBody.promptFeedback?.blockReason !== undefined) {
      throw new AiGenerationRejectedError({
        code: 'GEMINI_SAFETY_BLOCKED',
        message:
          'Gemini bloqueó la solicitud por seguridad. Ajusta el brief e inténtalo de nuevo.',
        retryable: false,
        model,
      });
    }

    const candidate = responseBody.candidates?.[0];
    if (
      candidate?.finishReason === 'SAFETY' ||
      candidate?.finishReason === 'BLOCKLIST'
    ) {
      throw new AiGenerationRejectedError({
        code: 'GEMINI_SAFETY_BLOCKED',
        message:
          'Gemini bloqueó la respuesta por seguridad. Ajusta el brief e inténtalo de nuevo.',
        retryable: false,
        model,
      });
    }

    const text = (candidate?.content?.parts ?? [])
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();

    if (text === '') {
      throw new AiGenerationInvalidResponseError({
        code: 'GEMINI_INVALID_RESPONSE',
        message:
          'Gemini no devolvió texto utilizable. Vuelve a intentarlo.',
        retryable: true,
        model,
      });
    }

    const totalTokens = responseBody.usageMetadata?.totalTokenCount;

    return {
      model,
      text,
      tokensUsed: typeof totalTokens === 'number' ? totalTokens : null,
    };
  }

  private logFailure(
    model: string,
    error: unknown,
    level: 'warn' | 'error',
  ): void {
    if (error instanceof GeminiHttpError) {
      const detail = error.message.replace(/\s+/g, ' ').slice(0, 300);
      this.logger[level](
        `Gemini ${model} (${error.kind} ${error.status ?? 'n/a'}): ${detail}`,
      );
      return;
    }
    if (error instanceof AiGenerationError) {
      this.logger[level](`Gemini ${model}: ${error.code}`);
      return;
    }
    this.logger[level](`Gemini ${model}: error inesperado`);
  }
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

function isRetryable(error: unknown): boolean {
  if (error instanceof AiGenerationError) {
    return error.retryable;
  }
  if (!(error instanceof GeminiHttpError)) {
    return false;
  }
  if (error.kind !== 'http') {
    return true;
  }
  return error.status !== null && RETRYABLE_STATUSES.has(error.status);
}

function isHighDemand(error: GeminiHttpError): boolean {
  const detail = `${error.upstreamStatus ?? ''} ${error.message}`.toLowerCase();
  return (
    detail.includes('overload') ||
    detail.includes('high demand') ||
    detail.includes('busy') ||
    detail.includes('capacity') ||
    detail.includes('try again later')
  );
}

function toDomainError(error: unknown, model: string): Error {
  if (error instanceof AiGenerationError) {
    return error;
  }
  if (!(error instanceof GeminiHttpError)) {
    return new AiGenerationUnavailableError({
      code: 'GEMINI_UNKNOWN',
      message:
        'Ocurrió un error inesperado con Gemini. Vuelve a intentarlo.',
      retryable: true,
      model,
    });
  }

  if (error.kind === 'timeout') {
    return new AiGenerationUnavailableError({
      code: 'GEMINI_TIMEOUT',
      message: 'Gemini tardó demasiado en responder. Vuelve a intentarlo.',
      retryable: true,
      httpStatus: 504,
      model,
    });
  }
  if (error.kind === 'network') {
    return new AiGenerationUnavailableError({
      code: 'GEMINI_UNREACHABLE',
      message:
        'No pudimos conectar con Gemini. Revisa la conexión y vuelve a intentarlo.',
      retryable: true,
      model,
    });
  }

  if (error.status === 401 || error.status === 403) {
    return new AiGenerationUnavailableError({
      code: 'GEMINI_AUTH_FAILED',
      message: 'No pudimos autenticar con Gemini. Avisa al administrador.',
      retryable: false,
      model,
    });
  }
  if (error.status === 404) {
    return new AiGenerationUnavailableError({
      code: 'GEMINI_MODEL_NOT_FOUND',
      message:
        'El modelo de Gemini configurado no está disponible. Avisa al administrador.',
      retryable: false,
      model,
    });
  }
  if (error.status === 429) {
    return new AiGenerationUnavailableError({
      code: 'GEMINI_QUOTA_EXCEEDED',
      message:
        'Gemini alcanzó su límite de uso o cuota. Espera unos minutos y vuelve a intentarlo.',
      retryable: true,
      httpStatus: 429,
      model,
    });
  }
  if (error.status === 503) {
    if (isHighDemand(error)) {
      return new AiGenerationUnavailableError({
        code: 'GEMINI_OVERLOADED',
        message:
          'Gemini está saturado por alta demanda. Espera un minuto y vuelve a intentarlo.',
        retryable: true,
        model,
      });
    }
    return new AiGenerationUnavailableError({
      code: 'GEMINI_UNAVAILABLE',
      message:
        'Gemini no está disponible temporalmente. Vuelve a intentarlo en unos minutos.',
      retryable: true,
      model,
    });
  }
  if (
    error.status === 500 ||
    error.status === 502 ||
    error.status === 504
  ) {
    return new AiGenerationUnavailableError({
      code: 'GEMINI_UPSTREAM_ERROR',
      message:
        'Gemini devolvió un error temporal. Vuelve a intentarlo.',
      retryable: true,
      httpStatus: 502,
      model,
    });
  }

  return new AiGenerationUnavailableError({
    code: 'GEMINI_UNKNOWN',
    message: 'Ocurrió un error inesperado con Gemini. Vuelve a intentarlo.',
    retryable: true,
    model,
  });
}

function buildResponseSchema(mode: GenerationMode): Record<string, unknown> {
  if (mode === 'IDEAS') {
    return {
      type: 'OBJECT',
      properties: {
        ideas: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              angle: { type: 'STRING' },
              hook: { type: 'STRING' },
              whyItWorks: { type: 'STRING' },
              suggestedFormat: { type: 'STRING' },
            },
            required: [
              'title',
              'angle',
              'hook',
              'whyItWorks',
              'suggestedFormat',
            ],
          },
        },
      },
      required: ['ideas'],
    };
  }

  return {
    type: 'OBJECT',
    properties: {
      variants: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            copy: { type: 'STRING' },
            hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
            cta: { type: 'STRING' },
            mediaPrompt: { type: 'STRING' },
            altText: { type: 'STRING' },
          },
          required: ['copy', 'hashtags', 'cta', 'mediaPrompt', 'altText'],
        },
      },
    },
    required: ['variants'],
  };
}
