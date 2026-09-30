import { Inject, Injectable } from '@nestjs/common';
import type { TargetMetric } from '../domain/metric.entity.js';
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
import { loadForUpdate, findTargetOrThrow } from './flow-helpers.js';

export interface ListMetricsInput {
  readonly publicationId: string;
  readonly platform: TargetPlatform;
}

/** Historial de snapshots de un destino (base de los gráficos de Analytics). */
@Injectable()
export class ListMetricsUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_TARGETS_REPOSITORY) private readonly targets: PublicationTargetsRepository,
    @Inject(PUBLICATION_METRICS_REPOSITORY) private readonly metrics: PublicationMetricsRepository,
  ) {}

  async execute(input: ListMetricsInput): Promise<TargetMetric[]> {
    await loadForUpdate(this.publications, input.publicationId);
    const target = await findTargetOrThrow(this.targets, input.publicationId, input.platform);
    return this.metrics.history(target.id);
  }
}
