import { Inject, Injectable } from '@nestjs/common';
import {
  InvalidPublicationTransitionError,
  InvalidTargetFormatError,
} from '../../../shared/errors.js';
import type { Publication, PublicationMediaType, Requester } from '../domain/publication.entity.js';
import {
  PUBLICATION_TARGETS_REPOSITORY,
  type PublicationTargetsRepository,
} from '../domain/ports/publication-targets.repository.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';
import { loadForUpdate, requireOwnerOrAdmin } from './flow-helpers.js';

export interface UpdateDraftInput {
  readonly id: string;
  readonly requester: Requester;
  readonly originalPrompt?: string;
  readonly title?: string | null;
  readonly copy?: string;
  readonly mediaUrl?: string;
  readonly mediaType?: PublicationMediaType;
}

/** Edita contenido solo mientras sea DRAFT (dueño o admin). */
@Injectable()
export class UpdateDraftUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_TARGETS_REPOSITORY)
    private readonly targets: PublicationTargetsRepository,
  ) {}

  async execute(input: UpdateDraftInput): Promise<Publication> {
    const publication = await loadForUpdate(this.publications, input.id);
    requireOwnerOrAdmin(publication, input.requester);
    if (publication.status !== 'DRAFT') {
      throw new InvalidPublicationTransitionError(publication.status, 'DRAFT (edit)');
    }
    if (input.mediaType === 'IMAGE') {
      const targets = await this.targets.findByPublication(input.id);
      if (targets.some((target) => target.format === 'REEL')) {
        throw new InvalidTargetFormatError(
          'Cannot change mediaType to IMAGE while REEL targets are attached',
        );
      }
    }
    return this.publications.update(input.id, {
      originalPrompt: input.originalPrompt,
      title: input.title,
      copy: input.copy,
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType,
    });
  }
}
