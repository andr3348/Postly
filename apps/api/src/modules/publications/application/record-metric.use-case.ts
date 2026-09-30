import { Inject, Injectable } from '@nestjs/common';
import { TargetNotPublishedError } from '../../../shared/errors.js';
import type { MetricSnapshot, TargetMetric } from '../domain/metric.entity.js';
import type { Requester } from '../domain/publication.entity.js';
import type { TargetPlatform } from '../domain/target.entity.js';
import {
  PUBLICATION_METRICS_REPOSITORY,
  type PublicationMetricsRepository,
} from '../domain/ports/publication-metrics.repository.js';
import {
  PUBLICATION_TARGETS_REPOSITORY,
  type PublicationTargetsRepository,
} from '../domain/ports/publication-targets.repository.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';
import { isAdmin, isOwner } from '../domain/publication.entity.js';
import { loadForUpdate, requireOwnerOrAdmin, findTargetOrThrow } from './flow-helpers.js';

export interface RecordMetricInput {
  readonly publicationId: string;
  readonly platform: TargetPlatform;
  readonly requester: Requester;
  readonly snapshot: MetricSnapshot;
}

/**
 * Registra un snapshot de métricas. Solo en destinos publicados
 * (medir lo no publicado es ruido) y solo dueño o admin por ahora;
 * n8n usará esta misma vía con auth de servicio cuando exista.
 */
@Injectable()
export class RecordMetricUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_TARGETS_REPOSITORY) private readonly targets: PublicationTargetsRepository,
    @Inject(PUBLICATION_METRICS_REPOSITORY) private readonly metrics: PublicationMetricsRepository,
  ) {}

  async execute(input: RecordMetricInput): Promise<TargetMetric> {
    const publication = await loadForUpdate(this.publications, input.publicationId);
    requireOwnerOrAdmin(publication, input.requester);
    const target = await findTargetOrThrow(this.targets, input.publicationId, input.platform);
    if (target.status !== 'SUCCESS') {
      throw new TargetNotPublishedError(input.publicationId, input.platform);
    }
    return this.metrics.record(target.id, input.snapshot);
  }
}
