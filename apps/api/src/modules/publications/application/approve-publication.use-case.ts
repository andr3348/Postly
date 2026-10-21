import { Inject, Injectable } from '@nestjs/common';
import {
  ForbiddenError,
  InvalidPublicationTransitionError,
  PublicationWithoutTargetsError,
} from '../../../shared/errors.js';
import { canTransition, isAdmin, type Publication } from '../domain/publication.entity.js';
import {
  PUBLICATION_TARGETS_REPOSITORY,
  type PublicationTargetsRepository,
} from '../domain/ports/publication-targets.repository.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';
import { loadForUpdate, type FlowInput } from './flow-helpers.js';

export interface ApprovePublicationInput extends FlowInput {
  readonly scheduledAt: Date;
}

/**
 * PENDING_APPROVAL → SCHEDULED (solo admin; fija auditoría y agenda).
 * Exige ≥1 canal: los destinos se pueden quitar en PENDING_APPROVAL, y una
 * publicación sin targets quedaría SCHEDULED para siempre (el claim la salta
 * al no tener destinos PENDING). Mismo contrato que `submit`.
 */
@Injectable()
export class ApprovePublicationUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_TARGETS_REPOSITORY)
    private readonly targets: PublicationTargetsRepository,
  ) {}

  async execute(input: ApprovePublicationInput): Promise<Publication> {
    const publication = await loadForUpdate(this.publications, input.id);
    if (!isAdmin(input.requester)) {
      throw new ForbiddenError('Only an admin can approve publications');
    }
    if (!canTransition(publication.status, 'SCHEDULED')) {
      throw new InvalidPublicationTransitionError(publication.status, 'SCHEDULED');
    }
    const targets = await this.targets.findByPublication(input.id);
    if (targets.length === 0) {
      throw new PublicationWithoutTargetsError(input.id, 'approved');
    }
    return this.publications.update(input.id, {
      status: 'SCHEDULED',
      scheduledAt: input.scheduledAt,
      approvedById: input.requester.id,
      approvedAt: new Date(),
    });
  }
}
