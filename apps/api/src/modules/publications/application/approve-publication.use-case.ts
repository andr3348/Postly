import { Inject, Injectable } from '@nestjs/common';
import { ForbiddenError, InvalidPublicationTransitionError } from '../../../shared/errors.js';
import { canTransition, isAdmin, type Publication } from '../domain/publication.entity.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';
import { loadForUpdate, type FlowInput } from './flow-helpers.js';

export interface ApprovePublicationInput extends FlowInput {
  readonly scheduledAt: Date;
}

/** PENDING_APPROVAL → SCHEDULED (solo admin; fija auditoría y agenda). */
@Injectable()
export class ApprovePublicationUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
  ) {}

  async execute(input: ApprovePublicationInput): Promise<Publication> {
    const publication = await loadForUpdate(this.publications, input.id);
    if (!isAdmin(input.requester)) {
      throw new ForbiddenError('Only an admin can approve publications');
    }
    if (!canTransition(publication.status, 'SCHEDULED')) {
      throw new InvalidPublicationTransitionError(publication.status, 'SCHEDULED');
    }
    return this.publications.update(input.id, {
      status: 'SCHEDULED',
      scheduledAt: input.scheduledAt,
      approvedById: input.requester.id,
      approvedAt: new Date(),
    });
  }
}
