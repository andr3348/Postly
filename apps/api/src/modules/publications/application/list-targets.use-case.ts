import { Inject, Injectable } from '@nestjs/common';
import { PublicationNotFoundError } from '../../../shared/errors.js';
import type { PublicationTarget } from '../domain/target.entity.js';
import {
  PUBLICATION_TARGETS_REPOSITORY,
  type PublicationTargetsRepository,
} from '../domain/ports/publication-targets.repository.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';

/** Lista los canales con su estado de publicación. */
@Injectable()
export class ListTargetsUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_TARGETS_REPOSITORY) private readonly targets: PublicationTargetsRepository,
  ) {}

  async execute(publicationId: string): Promise<PublicationTarget[]> {
    const publication = await this.publications.findById(publicationId);
    if (publication === null) {
      throw new PublicationNotFoundError(publicationId);
    }
    return this.targets.findByPublication(publicationId);
  }
}
