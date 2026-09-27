import { Inject, Injectable } from '@nestjs/common';
import type { Publication } from '../domain/publication.entity.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationFilters,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';

@Injectable()
export class ListPublicationsUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
  ) {}

  async execute(filters: PublicationFilters): Promise<Publication[]> {
    return this.publications.findMany(filters);
  }
}
