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

/** Lease del reclamo: si n8n no reporta dentro de este plazo, la pieza se expira. */
const LEASE_TIMEOUT_MS = 15 * 60_000;

/** Tope por pasada: el barrido es perezoso (corre al inicio de cada claim). */
const STALE_BATCH_SIZE = 10;

const STALE_ERROR_MESSAGE =
  'Despacho vencido: n8n no reportó dentro del lease (estado real del post desconocido).';

/**
 * Expira claims abandonados por n8n: PROCESSING con `dispatchedAt` más viejo
 * que el lease (el proceso murió entre reclamar y reportar).
 *
 * Dos desenlaces según lo que n8n alcanzó a reportar:
 * - Nada reportado: murió antes de publicar (p. ej. antes del IF). La pieza
 *   vuelve a SCHEDULED y el mismo claim la re-entrega — reintento automático
 *   con ventana de duplicado mínima (caída entre publicar el primer destino y
 *   su reporte, que el flujo minimiza reportando apenas publica cada uno).
 * - Algo reportado: murió a mitad. Los destinos sin reportar pasan a FAILED
 *   con mensaje y la publicación se cierra con `resolveTerminalStatus`
 *   (FAILED/PARTIAL) sin reintento: duplicar un post es peor que perderlo.
 *
 * Corre perezoso al inicio de cada claim: muerto n8n, el primer poll que
 * vuelva a pedir trabajo limpia la cola colgada y sigue con la siguiente.
 */
@Injectable()
export class ExpireStaleClaimsUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_TARGETS_REPOSITORY) private readonly targets: PublicationTargetsRepository,
  ) {}

  async execute(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - LEASE_TIMEOUT_MS);
    const stale = await this.publications.findStaleProcessing(cutoff, STALE_BATCH_SIZE);
    for (const publication of stale) {
      const targets = await this.targets.findByPublication(publication.id);
      const anyReported = targets.some((target) => target.status !== 'PENDING');
      if (!anyReported) {
        // Nada reportado: n8n murió antes de publicar. Reencolar (el mismo
        // claim la re-entrega); sin reportes no hay post que duplicar.
        await this.publications.update(publication.id, {
          status: 'SCHEDULED',
          dispatchedAt: null,
        });
        continue;
      }
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
