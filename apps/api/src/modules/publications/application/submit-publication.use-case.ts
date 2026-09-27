import { Inject, Injectable } from '@nestjs/common';
import {
  InvalidPublicationTransitionError,
  PublicationWithoutTargetsError,
} from '../../../shared/errors.js';
import type { Publication } from '../domain/publication.entity.js';
import { canTransition } from '../domain/publication.entity.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';
import {
  PUBLICATION_TARGETS_REPOSITORY,
  type PublicationTargetsRepository,
} from '../domain/ports/publication-targets.repository.js';
import { loadForUpdate, requireOwnerOrAdmin, type FlowInput } from './flow-helpers.js';

/** DRAFT → PENDING_APPROVAL (dueño o admin; exige ≥1 canal destino). */
@Injectable()
export class SubmitPublicationUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_TARGETS_REPOSITORY) private readonly targets: PublicationTargetsRepository,
  ) {}

  async execute(input: FlowInput): Promise<Publication> {
    const publication = await loadForUpdate(this.publications, input.id);
    requireOwnerOrAdmin(publication, input.requester);
    if (!canTransition(publication.status, 'PENDING_APPROVAL')) {
      throw new InvalidPublicationTransitionError(publication.status, 'PENDING_APPROVAL');
    }
    const targets = await this.targets.findByPublication(input.id);
    if (targets.length === 0) {
      throw new PublicationWithoutTargetsError(input.id);
    }
    return this.publications.update(input.id, { status: 'PENDING_APPROVAL' });
  }
}
