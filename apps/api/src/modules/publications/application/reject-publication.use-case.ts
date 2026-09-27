import { Inject, Injectable } from '@nestjs/common';
import { ForbiddenError, InvalidPublicationTransitionError } from '../../../shared/errors.js';
import { canTransition, isAdmin, type Publication } from '../domain/publication.entity.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';
import { loadForUpdate, type FlowInput } from './flow-helpers.js';

/** PENDING_APPROVAL → DRAFT (solo admin; devuelve a edición). */
@Injectable()
export class RejectPublicationUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
  ) {}

  async execute(input: FlowInput): Promise<Publication> {
    const publication = await loadForUpdate(this.publications, input.id);
    if (!isAdmin(input.requester)) {
      throw new ForbiddenError('Only an admin can reject publications');
    }
    if (!canTransition(publication.status, 'DRAFT')) {
      throw new InvalidPublicationTransitionError(publication.status, 'DRAFT');
    }
    return this.publications.update(input.id, { status: 'DRAFT' });
  }
}
