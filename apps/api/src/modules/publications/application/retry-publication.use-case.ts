import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ForbiddenError,
  PublicationNotFoundError,
  PublicationRetryNotAllowedError,
  PublicationTargetNotFoundError,
  RetryLimitExceededError,
  UnsupportedRetryPlatformError,
} from '../../../shared/errors.js';
import {
  isAdmin,
  type Publication,
  type Requester,
} from '../domain/publication.entity.js';
import {
  MAX_TARGET_RETRIES,
  isRetryablePlatform,
  type RetryablePlatform,
} from '../domain/target.entity.js';
import { resolveTargetFailure } from '../domain/target-failure.js';
import {
  DISPATCH_NOTIFIER,
  type DispatchNotifier,
} from '../domain/ports/dispatch-notifier.port.js';
import {
  PUBLICATION_UNIT_OF_WORK,
  type PublicationUnitOfWork,
} from '../domain/ports/publication-unit-of-work.port.js';

export interface RetryPublicationInput {
  readonly id: string;
  readonly platforms: readonly RetryablePlatform[];
  readonly requester: Requester;
}

/**
 * Reintento manual de canales fallidos. Solo ADMIN, solo PUBLICACIONES
 * PARTIAL/FAILED y solo targets Facebook/Instagram con un fallo seguro.
 *
 * No vuelve a pedir aprobación: reutiliza la publicación y su auditoría. Los
 * targets exitosos no se tocan; n8n solo recibirá los que vuelven a PENDING.
 */
@Injectable()
export class RetryPublicationUseCase {
  private readonly logger = new Logger(RetryPublicationUseCase.name);

  constructor(
    @Inject(PUBLICATION_UNIT_OF_WORK) private readonly uow: PublicationUnitOfWork,
    @Inject(DISPATCH_NOTIFIER) private readonly notifier: DispatchNotifier,
  ) {}

  async execute(input: RetryPublicationInput): Promise<Publication> {
    if (!isAdmin(input.requester)) {
      throw new ForbiddenError('Solo un administrador puede reintentar publicaciones');
    }

    const platforms = [...new Set(input.platforms)];
    if (platforms.length === 0) {
      throw new PublicationRetryNotAllowedError('Selecciona al menos un canal para reintentar.');
    }
    for (const platform of platforms) {
      if (!isRetryablePlatform(platform)) {
        throw new UnsupportedRetryPlatformError(platform);
      }
    }

    const now = new Date();
    const publication = await this.uow.run(async (tx) => {
      const current = await tx.lockPublication(input.id);
      if (current === null) {
        throw new PublicationNotFoundError(input.id);
      }
      if (current.status !== 'PARTIAL' && current.status !== 'FAILED') {
        throw new PublicationRetryNotAllowedError(
          'La publicación todavía no terminó o no tiene fallos reintentables.',
        );
      }

      const targets = await tx.findTargets(input.id);
      for (const platform of platforms) {
        const target = targets.find((item) => item.platform === platform);
        if (target === undefined) {
          throw new PublicationTargetNotFoundError(input.id, platform);
        }
        if (target.status !== 'FAILED') {
          throw new PublicationRetryNotAllowedError(
            `El canal ${platform} no falló; no se volverá a publicar.`,
          );
        }
        if (target.retryCount >= MAX_TARGET_RETRIES) {
          throw new RetryLimitExceededError(platform, MAX_TARGET_RETRIES);
        }

        const failure = resolveTargetFailure(target);
        if (failure === null || !failure.retryable) {
          throw new PublicationRetryNotAllowedError(
            failure?.action ??
              'El canal no tiene un fallo seguro para reintentar. Crea una nueva publicación.',
          );
        }

        await tx.updateTarget(target.id, {
          status: 'PENDING',
          externalPostId: null,
          externalPostUrl: null,
          errorMessage: null,
          failure: null,
          publishedAt: null,
          retryCount: target.retryCount + 1,
        });
      }

      return tx.updatePublication(input.id, {
        status: 'SCHEDULED',
        scheduledAt: now,
        dispatchedAt: null,
        dispatchAttemptId: null,
      });
    });

    try {
      await this.notifier.notify();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[retry] Could not wake n8n for publication ${publication.id}: ${detail}`,
      );
    }

    return publication;
  }
}
