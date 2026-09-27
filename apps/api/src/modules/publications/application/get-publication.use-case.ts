import { Inject, Injectable } from '@nestjs/common';
import { PublicationNotFoundError } from '../../../shared/errors.js';
import type { Publication } from '../domain/publication.entity.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';

@Injectable()
export class GetPublicationUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
  ) {}

  async execute(id: string): Promise<Publication> {
    const publication = await this.publications.findById(id);
    if (publication === null) {
      throw new PublicationNotFoundError(id);
    }
    return publication;
  }
}
