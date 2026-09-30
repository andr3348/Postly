import { Inject, Injectable } from '@nestjs/common';
import { PublicationNotFoundError, PublicationTargetNotFoundError } from '../../../shared/errors.js';
import type { MetricSnapshot } from '../../publications/domain/metric.entity.js';
import type { Publication } from '../../publications/domain/publication.entity.js';
import type { TargetStatus } from '../../publications/domain/target.entity.js';
import {
  PUBLICATION_METRICS_REPOSITORY,
  type PublicationMetricsRepository,
} from '../../publications/domain/ports/publication-metrics.repository.js';
import {
  PUBLICATION_TARGETS_REPOSITORY,
  type PublicationTargetsRepository,
} from '../../publications/domain/ports/publication-targets.repository.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../../publications/domain/ports/publications.repository.js';

export interface ReportTargetInput {
  readonly targetId: string;
  readonly status: Extract<TargetStatus, 'SUCCESS' | 'FAILED'>;
  readonly externalPostId?: string;
  readonly externalPostUrl?: string;
  readonly errorMessage?: string;
  readonly metrics?: MetricSnapshot;
}

export interface ReportTargetOutput {
  readonly publication: Publication;
  readonly terminal: boolean;
}

/**
 * Reporte de n8n por destino: actualiza el target, registra métricas
 * opcionales y recalcula la publicación (PUBLISHED / PARTIAL / FAILED
 * cuando no quedan PENDING; si quedan, sigue PROCESSING).
 */
@Injectable()
export class ReportTargetUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_TARGETS_REPOSITORY) private readonly targets: PublicationTargetsRepository,
    @Inject(PUBLICATION_METRICS_REPOSITORY) private readonly metrics: PublicationMetricsRepository,
  ) {}

  async execute(input: ReportTargetInput): Promise<ReportTargetOutput> {
    const target = await this.targets.findById(input.targetId);
    if (target === null) {
      throw new PublicationTargetNotFoundError(input.targetId, input.targetId);
    }
    await this.targets.updateTarget(target.id, {
      status: input.status,
      externalPostId: input.externalPostId,
      externalPostUrl: input.externalPostUrl,
      errorMessage: input.errorMessage,
      publishedAt: input.status === 'SUCCESS' ? new Date() : undefined,
    });
    if (input.metrics !== undefined) {
      await this.metrics.record(target.id, input.metrics);
    }
    const siblings = await this.targets.findByPublication(target.publicationId);
    const statuses = siblings.map((sibling) => sibling.status);
    if (statuses.some((status) => status === 'PENDING')) {
      const publication = await this.requirePublication(target.publicationId);
      return { publication, terminal: false };
    }
    const finalStatus = statuses.every((status) => status === 'SUCCESS')
      ? 'PUBLISHED'
      : statuses.every((status) => status === 'FAILED')
        ? 'FAILED'
        : 'PARTIAL';
    const publication = await this.publications.update(target.publicationId, {
      status: finalStatus,
    });
    return { publication, terminal: true };
  }

  private async requirePublication(publicationId: string): Promise<Publication> {
    const publication = await this.publications.findById(publicationId);
    if (publication === null) {
      throw new PublicationNotFoundError(publicationId);
    }
    return publication;
  }
}
