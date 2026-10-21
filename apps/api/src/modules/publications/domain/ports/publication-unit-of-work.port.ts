import type { MetricSnapshot, TargetMetric } from '../metric.entity.js';
import type { Publication } from '../publication.entity.js';
import type {
  PublicationTarget,
  TargetFailure,
  TargetStatus,
} from '../target.entity.js';
import type { UpdatePublicationData } from './publications.repository.js';

/**
 * Operaciones que deben compartir una transacción con lock de la publicación.
 * El reporte de n8n y el reintento manual leen y escriben varios agregados;
 * hacerlo fuera de una transacción deja publicaciones atrapadas en PROCESSING
 * cuando Facebook e Instagram reportan al mismo tiempo.
 */
export interface PublicationTransaction {
  /** Bloquea la fila de la publicación (SELECT ... FOR UPDATE) y la relee. */
  lockPublication(id: string): Promise<Publication | null>;
  findPublication(id: string): Promise<Publication | null>;
  findTarget(id: string): Promise<PublicationTarget | null>;
  findTargets(publicationId: string): Promise<PublicationTarget[]>;
  updateTarget(
    id: string,
    data: {
      readonly status?: TargetStatus;
      readonly externalPostId?: string | null;
      readonly externalPostUrl?: string | null;
      readonly errorMessage?: string | null;
      readonly failure?: TargetFailure | null;
      readonly retryCount?: number;
      readonly publishedAt?: Date | null;
    },
  ): Promise<PublicationTarget>;
  updatePublication(id: string, data: UpdatePublicationData): Promise<Publication>;
  recordMetric(targetId: string, snapshot: MetricSnapshot): Promise<TargetMetric>;
}

export interface PublicationUnitOfWork {
  run<T>(work: (tx: PublicationTransaction) => Promise<T>): Promise<T>;
}

export const PUBLICATION_UNIT_OF_WORK: unique symbol = Symbol('PublicationUnitOfWork');
