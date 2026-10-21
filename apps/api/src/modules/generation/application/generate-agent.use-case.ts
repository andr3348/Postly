import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiGenerationInvalidResponseError } from '../../../shared/errors.js';
import { CreatePublicationUseCase } from '../../publications/application/create-publication.use-case.js';
import type { Publication } from '../../publications/domain/publication.entity.js';
import type {
  GenerationFormat,
  GenerationMediaType,
  GenerationPlatform,
} from '../domain/generated-content.entity.js';
import {
  MEDIA_GENERATOR,
  type MediaGenerator,
} from '../domain/ports/media-generator.port.js';
import {
  MEDIA_STORAGE,
  type MediaStorage,
} from '../domain/ports/media-storage.port.js';
import { buildVariantCopy } from './build-variant-copy.js';
import { GenerateTextUseCase } from './generate-text.use-case.js';

/** Entrada del modo agente: marca + brief + red y formato destino. */
export interface GenerateAgentInput {
  readonly requesterId: string;
  readonly brandId: string;
  readonly prompt: string;
  readonly platform: GenerationPlatform;
  readonly format: GenerationFormat;
  readonly mediaType?: GenerationMediaType;
}

const EXTENSION_BY_CONTENT_TYPE: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

function extensionFor(
  contentType: string,
  mediaType: GenerationMediaType,
): string {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return (
    EXTENSION_BY_CONTENT_TYPE[normalized] ??
    (mediaType === 'VIDEO' ? 'mp4' : 'jpg')
  );
}

/**
 * Modo agente: un solo request que orquesta texto → media → almacenamiento
 * propio → borrador persistido. El DRAFT lo crea el backend dentro del mismo
 * request para que un refresh del cliente no pierda la media ya generada.
 */
@Injectable()
export class GenerateAgentUseCase {
  constructor(
    private readonly generateText: GenerateTextUseCase,
    @Inject(MEDIA_GENERATOR) private readonly mediaGenerator: MediaGenerator,
    @Inject(MEDIA_STORAGE) private readonly mediaStorage: MediaStorage,
    private readonly createPublication: CreatePublicationUseCase,
  ) {}

  async execute(input: GenerateAgentInput): Promise<Publication> {
    const mediaType =
      input.mediaType ?? (input.format === 'REEL' ? 'VIDEO' : 'IMAGE');

    const generated = await this.generateText.execute({
      brandId: input.brandId,
      mode: 'COPY',
      prompt: input.prompt,
      platform: input.platform,
      format: input.format,
      mediaType,
    });

    const variant = generated.variants[0];
    if (variant === undefined) {
      throw new AiGenerationInvalidResponseError({
        code: 'GEMINI_INVALID_RESPONSE',
        message:
          'La IA no devolvió ninguna variante de texto. Vuelve a intentarlo.',
        retryable: true,
        model: generated.model,
      });
    }

    const media = await this.mediaGenerator.generate({
      prompt:
        variant.mediaPrompt.trim() === '' ? variant.copy : variant.mediaPrompt,
      mediaType,
      aspectRatio: input.format === 'REEL' ? '9:16' : '1:1',
    });

    const key = `publications/${randomUUID()}.${extensionFor(
      media.contentType,
      mediaType,
    )}`;
    const mediaUrl = await this.mediaStorage.uploadFromUrl({
      sourceUrl: media.url,
      contentType: media.contentType,
      key,
    });

    return this.createPublication.execute({
      brandId: input.brandId,
      userId: input.requesterId,
      originalPrompt: input.prompt,
      title: variant.title,
      copy: buildVariantCopy(variant),
      mediaUrl,
      mediaType,
      modelText: generated.model,
      modelMedia: media.model,
      tokensUsed: generated.tokensUsed,
    });
  }
}
