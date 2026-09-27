import { Inject, Injectable } from '@nestjs/common';
import {
  ForbiddenError,
  InvalidPublicationTransitionError,
  PublicationNotFoundError,
  PublicationTargetAlreadyAttachedError,
} from '../../../shared/errors.js';
import type { PublicationTarget, TargetPlatform } from '../domain/target.entity.js';
import type { Publication, Requester } from '../domain/publication.entity.js';
import {
  PUBLICATION_TARGETS_REPOSITORY,
  type PublicationTargetsRepository,
} from '../domain/ports/publication-targets.repository.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';
import { loadForUpdate, requireOwnerOrAdmin } from './flow-helpers.js';

export interface AddTargetInput {
  readonly publicationId: string;
  readonly platform: TargetPlatform;
  readonly requester: Requester;
}

/** Adjunta un canal (dueño o admin, solo antes de programar). */
@Injectable()
export class AddTargetUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_TARGETS_REPOSITORY) private readonly targets: PublicationTargetsRepository,
  ) {}

  async execute(input: AddTargetInput): Promise<PublicationTarget> {
    const publication = await loadForUpdate(this.publications, input.publicationId);
    requireOwnerOrAdmin(publication, input.requester);
    requireEditable(publication);
    const existing = await this.targets.findByPublication(input.publicationId);
    if (existing.some((target) => target.platform === input.platform)) {
      throw new PublicationTargetAlreadyAttachedError(input.publicationId, input.platform);
    }
    return this.targets.add(input.publicationId, input.platform);
  }
}

function requireEditable(publication: Publication): void {
  if (publication.status !== 'DRAFT' && publication.status !== 'PENDING_APPROVAL') {
    throw new InvalidPublicationTransitionError(publication.status, 'edit targets');
  }
}
