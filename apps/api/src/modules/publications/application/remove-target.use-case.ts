import { Inject, Injectable } from '@nestjs/common';
import { PublicationTargetNotFoundError } from '../../../shared/errors.js';
import type { TargetPlatform } from '../domain/target.entity.js';
import type { Requester } from '../domain/publication.entity.js';
import {
  PUBLICATION_TARGETS_REPOSITORY,
  type PublicationTargetsRepository,
} from '../domain/ports/publication-targets.repository.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';
import {
  loadForUpdate,
  requireOwnerOrAdmin,
  requireTargetsEditable,
} from './flow-helpers.js';

export interface RemoveTargetInput {
  readonly publicationId: string;
  readonly platform: TargetPlatform;
  readonly requester: Requester;
}

/** Quita un canal (dueño o admin, solo antes de programar). */
@Injectable()
export class RemoveTargetUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_TARGETS_REPOSITORY) private readonly targets: PublicationTargetsRepository,
  ) {}

  async execute(input: RemoveTargetInput): Promise<void> {
    const publication = await loadForUpdate(this.publications, input.publicationId);
    requireOwnerOrAdmin(publication, input.requester);
    requireTargetsEditable(publication);
    const removed = await this.targets.remove(input.publicationId, input.platform);
    if (!removed) {
      throw new PublicationTargetNotFoundError(input.publicationId, input.platform);
    }
  }
}
