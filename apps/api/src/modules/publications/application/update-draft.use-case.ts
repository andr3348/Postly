import { Inject, Injectable } from '@nestjs/common';
import { InvalidPublicationTransitionError } from '../../../shared/errors.js';
import type { Publication, PublicationMediaType, Requester } from '../domain/publication.entity.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';
import { loadForUpdate, requireOwnerOrAdmin } from './flow-helpers.js';

export interface UpdateDraftInput {
  readonly id: string;
  readonly requester: Requester;
  readonly originalPrompt?: string;
  readonly copy?: string;
  readonly mediaUrl?: string;
  readonly mediaType?: PublicationMediaType;
}

/** Edita contenido solo mientras sea DRAFT (dueño o admin). */
@Injectable()
export class UpdateDraftUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
  ) {}

  async execute(input: UpdateDraftInput): Promise<Publication> {
    const publication = await loadForUpdate(this.publications, input.id);
    requireOwnerOrAdmin(publication, input.requester);
    if (publication.status !== 'DRAFT') {
      throw new InvalidPublicationTransitionError(publication.status, 'DRAFT (edit)');
    }
    return this.publications.update(input.id, {
      originalPrompt: input.originalPrompt,
      copy: input.copy,
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType,
    });
  }
}
