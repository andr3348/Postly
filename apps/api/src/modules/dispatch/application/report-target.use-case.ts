import { Inject, Injectable } from '@nestjs/common';
import {
  InvalidTargetReportError,
  PublicationNotFoundError,
  PublicationTargetNotFoundError,
  StaleDispatchAttemptError,
  TargetAlreadyReportedError,
} from '../../../shared/errors.js';
import type { MetricSnapshot } from '../../publications/domain/metric.entity.js';
import { resolveTerminalStatus, type Publication } from '../../publications/domain/publication.entity.js';
import type { FailureStage, TargetStatus } from '../../publications/domain/target.entity.js';
import {
  classifyTargetFailure,
  type ReportProviderError,
} from '../../publications/domain/target-failure.js';
import {
  PUBLICATION_UNIT_OF_WORK,
  type PublicationUnitOfWork,
} from '../../publications/domain/ports/publication-unit-of-work.port.js';

export interface ReportTargetInput {
  readonly targetId: string;
  readonly dispatchAttemptId: string;
  readonly status: Extract<TargetStatus, 'SUCCESS' | 'FAILED'>;
  readonly stage?: FailureStage;
  readonly externalPostId?: string;
  readonly externalPostUrl?: string;
  readonly errorMessage?: string;
  readonly error?: ReportProviderError;
  readonly metrics?: MetricSnapshot;
}

export interface ReportTargetOutput {
  readonly publication: Publication;
  readonly terminal: boolean;
}

/**
 * Reporte de n8n por destino. Todo ocurre dentro de una transacción con lock
 * de la publicación: validar el intento, actualizar el target, guardar
 * métricas y cerrar la publicación cuando ya no quedan destinos PENDING.
 *
 * Un reporte de un intento viejo devuelve 409. Un duplicado del mismo target
 * con el mismo estado es idempotente (n8n puede reintentar el POST).
 */
@Injectable()
export class ReportTargetUseCase {
  constructor(
    @Inject(PUBLICATION_UNIT_OF_WORK) private readonly uow: PublicationUnitOfWork,
  ) {}

  async execute(input: ReportTargetInput): Promise<ReportTargetOutput> {
    const failure =
      input.status === 'FAILED' ? this.classifyFailure(input) : null;
    if (input.status === 'SUCCESS' && input.externalPostId === undefined) {
      throw new InvalidTargetReportError('el éxito requiere externalPostId');
    }

    return this.uow.run(async (tx) => {
      const initialTarget = await tx.findTarget(input.targetId);
      if (initialTarget === null) {
        throw new PublicationTargetNotFoundError(input.targetId, input.targetId);
      }

      const publication = await tx.lockPublication(initialTarget.publicationId);
      if (publication === null) {
        throw new PublicationNotFoundError(initialTarget.publicationId);
      }

      if (
        publication.dispatchAttemptId === null ||
        publication.dispatchAttemptId !== input.dispatchAttemptId
      ) {
        throw new StaleDispatchAttemptError();
      }

      const target = await tx.findTarget(input.targetId);
      if (target === null) {
        throw new PublicationTargetNotFoundError(input.targetId, input.targetId);
      }

      if (target.status !== 'PENDING') {
        if (target.status === input.status) {
          return {
            publication,
            terminal: publication.status !== 'PROCESSING',
          };
        }
        throw new TargetAlreadyReportedError(target.id);
      }

      if (publication.status !== 'PROCESSING') {
        throw new StaleDispatchAttemptError();
      }

      await tx.updateTarget(target.id, {
        status: input.status,
        externalPostId: input.status === 'SUCCESS' ? input.externalPostId : null,
        externalPostUrl: input.status === 'SUCCESS' ? input.externalPostUrl : null,
        errorMessage: input.status === 'FAILED' ? input.errorMessage : null,
        failure,
        publishedAt: input.status === 'SUCCESS' ? new Date() : null,
      });

      if (input.metrics !== undefined) {
        await tx.recordMetric(target.id, input.metrics);
      }

      const siblings = await tx.findTargets(publication.id);
      const statuses = siblings.map((sibling) => sibling.status);
      if (statuses.some((status) => status === 'PENDING')) {
        return { publication, terminal: false };
      }

      const updated = await tx.updatePublication(publication.id, {
        status: resolveTerminalStatus(statuses),
      });
      return { publication: updated, terminal: true };
    });
  }

  private classifyFailure(input: ReportTargetInput) {
    if (input.stage === undefined || (input.errorMessage === undefined && input.error === undefined)) {
      throw new InvalidTargetReportError(
        'el fallo requiere stage y errorMessage o error estructurado',
      );
    }
    return classifyTargetFailure({
      stage: input.stage,
      errorMessage: input.errorMessage,
      error: input.error,
    });
  }
}
