import { Inject, Injectable } from '@nestjs/common';
import type { ConnectedAccountWithCredentials } from '../../connected-accounts/domain/connected-account.entity.js';
import type { Publication } from '../../publications/domain/publication.entity.js';
import type { PublicationTarget } from '../../publications/domain/target.entity.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../../publications/domain/ports/publications.repository.js';
import {
  PUBLICATION_TARGETS_REPOSITORY,
  type PublicationTargetsRepository,
} from '../../publications/domain/ports/publication-targets.repository.js';
import {
  DISPATCH_CREDENTIALS,
  type DispatchCredentials,
} from '../domain/ports/dispatch-credentials.port.js';

export interface TargetDispatch {
  readonly target: PublicationTarget;
  readonly credentials: ConnectedAccountWithCredentials;
}

export interface DispatchClaim {
  readonly publication: Publication;
  readonly targets: TargetDispatch[];
}

const CLAIM_BATCH_SIZE = 10;

/**
 * Reclamo atómico para n8n: devuelve la próxima vencida con todo lo
 * necesario (contenido + destinos PENDING + credenciales descifradas) y la
 * marca PROCESSING en la misma pasada. `null` = nada por hacer.
 *
 * Sin credenciales para algún canal no se reclama (400): mejor fallar
 * visible que envenenar la cola con un despacho imposible. Si otro worker
 * la tomó primero (`markProcessing` falso), se intenta con la siguiente.
 */
@Injectable()
export class ClaimDispatchUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_TARGETS_REPOSITORY) private readonly targets: PublicationTargetsRepository,
    @Inject(DISPATCH_CREDENTIALS) private readonly credentials: DispatchCredentials,
  ) {}

  async execute(now: Date = new Date()): Promise<DispatchClaim | null> {
    const due = await this.publications.findDueDispatch(CLAIM_BATCH_SIZE, now);
    for (const publication of due) {
      const all = await this.targets.findByPublication(publication.id);
      const pending = all.filter((target) => target.status === 'PENDING');
      if (pending.length === 0) {
        continue;
      }
      const credentials = await this.credentials.getForDispatch(
        publication.brandId,
        pending.map((target) => target.platform),
      );
      const claimed = await this.publications.markProcessing(publication.id);
      if (!claimed) {
        continue;
      }
      // Releer: `publication` trae el estado previo al reclamo.
      const claimedPublication = await this.publications.findById(publication.id);
      if (claimedPublication === null) {
        continue;
      }
      return {
        publication: claimedPublication,
        targets: pending.map((target) => ({
          target,
          credentials: findCredentials(credentials, target),
        })),
      };
    }
    return null;
  }
}

function findCredentials(
  credentials: ConnectedAccountWithCredentials[],
  target: PublicationTarget,
): ConnectedAccountWithCredentials {
  const match = credentials.find((item) => item.platform === target.platform);
  if (match === undefined) {
    // Imposible si GetCredentialsUseCase cumplió su contrato (lanza si falta
    // alguna plataforma pedida); defensa explícita en vez de `!`.
    throw new Error(`[dispatch] Missing credentials for ${target.platform} after check`);
  }
  return match;
}
