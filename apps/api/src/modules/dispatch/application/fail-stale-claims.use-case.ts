import { Inject, Injectable } from '@nestjs/common';
import { resolveTerminalStatus } from '../../publications/domain/publication.entity.js';
import {
  PUBLICATION_TARGETS_REPOSITORY,
  type PublicationTargetsRepository,
} from '../../publications/domain/ports/publication-targets.repository.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../../publications/domain/ports/publications.repository.js';

/** Lease del reclamo: si n8n no reporta dentro de este plazo, la pieza se cierra. */
const LEASE_TIMEOUT_MS = 15 * 60_000;

/** Tope por pasada: el barrido es perezoso (corre al inicio de cada claim). */
const STALE_BATCH_SIZE = 10;

const STALE_ERROR_MESSAGE =
  'Despacho vencido: n8n no reportó dentro del lease (estado real del post desconocido).';

/**
 * Cierra claims abandonados por n8n: PROCESSING con `dispatchedAt` más viejo
 * que el lease (el proceso murió entre reclamar y reportar).
 *
 * Política sin reintento (a propósito): reencolar podría duplicar un post si
 * la caída fue justo entre publicar en la red y reportar. Los destinos sin
 * reportar pasan a FAILED con mensaje explícito y la publicación se cierra
 * con la misma regla que el reporte (`resolveTerminalStatus`): FAILED si
 * nada se reportó, PARTIAL si algo alcanzó a publicarse.
 *
 * Corre perezoso al inicio de cada claim: muerto n8n, el primer poll que
 * vuelva a pedir trabajo limpia la cola colgada y sigue con la siguiente.
 */
@Injectable()
export class FailStaleClaimsUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_TARGETS_REPOSITORY) private readonly targets: PublicationTargetsRepository,
  ) {}

  async execute(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - LEASE_TIMEOUT_MS);
    const stale = await this.publications.findStaleProcessing(cutoff, STALE_BATCH_SIZE);
    for (const publication of stale) {
      const targets = await this.targets.findByPublication(publication.id);
      const pending = targets.filter((target) => target.status === 'PENDING');
      for (const target of pending) {
        await this.targets.updateTarget(target.id, {
          status: 'FAILED',
          errorMessage: STALE_ERROR_MESSAGE,
        });
      }
      // Releer: refleja lo ya reportado por n8n antes de la caída.
      const siblings = await this.targets.findByPublication(publication.id);
      await this.publications.update(publication.id, {
        status: resolveTerminalStatus(siblings.map((sibling) => sibling.status)),
      });
    }
    return stale.length;
  }
}
