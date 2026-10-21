import { Inject, Injectable } from '@nestjs/common';
import { resolveTerminalStatus } from '../../publications/domain/publication.entity.js';
import { staleDispatchFailure } from '../../publications/domain/target-failure.js';
import {
  PUBLICATION_UNIT_OF_WORK,
  type PublicationUnitOfWork,
} from '../../publications/domain/ports/publication-unit-of-work.port.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../../publications/domain/ports/publications.repository.js';

/** Lease del reclamo: si n8n no reporta dentro de este plazo, la pieza se expira. */
const LEASE_TIMEOUT_MS = 15 * 60_000;

/** Tope por pasada: el barrido es perezoso (corre al inicio de cada claim). */
const STALE_BATCH_SIZE = 10;

const STALE_ERROR_MESSAGE =
  'Despacho vencido: n8n no reportó dentro del lease (estado real del post desconocido).';

/**
 * Expira claims abandonados por n8n. Cada cierre corre en una transacción con
 * lock de la publicación para no competir con un reporte que llega tarde.
 *
 * - Nada reportado: vuelve a SCHEDULED y se re-entrega (sin post que duplicar).
 * - Algo reportado: los PENDING pasan a FAILED (`UNKNOWN_OUTCOME`, sin
 *   reintento) y la publicación se cierra según lo ya reportado.
 */
@Injectable()
export class ExpireStaleClaimsUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_UNIT_OF_WORK) private readonly uow: PublicationUnitOfWork,
  ) {}

  async execute(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - LEASE_TIMEOUT_MS);
    const stale = await this.publications.findStaleProcessing(cutoff, STALE_BATCH_SIZE);
    let expired = 0;

    for (const candidate of stale) {
      const handled = await this.uow.run(async (tx) => {
        const publication = await tx.lockPublication(candidate.id);
        if (publication === null || publication.status !== 'PROCESSING') {
          return false;
        }

        const targets = await tx.findTargets(publication.id);
        const anyReported = targets.some((target) => target.status !== 'PENDING');
        if (!anyReported) {
          await tx.updatePublication(publication.id, {
            status: 'SCHEDULED',
            dispatchedAt: null,
            dispatchAttemptId: null,
          });
          return true;
        }

        const failure = staleDispatchFailure();
        for (const target of targets.filter((item) => item.status === 'PENDING')) {
          await tx.updateTarget(target.id, {
            status: 'FAILED',
            errorMessage: STALE_ERROR_MESSAGE,
            failure,
            publishedAt: null,
          });
        }

        const siblings = await tx.findTargets(publication.id);
        await tx.updatePublication(publication.id, {
          status: resolveTerminalStatus(siblings.map((sibling) => sibling.status)),
          dispatchAttemptId: null,
        });
        return true;
      });

      if (handled) {
        expired += 1;
      }
    }

    return expired;
  }
}
