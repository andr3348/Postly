import { Inject, Injectable } from '@nestjs/common';
import { BRANDS_REPOSITORY, type BrandsRepository } from '../../brand/domain/ports/brands.repository.js';
import { BrandNotFoundError } from '../../../shared/errors.js';
import type { Publication, PublicationMediaType } from '../domain/publication.entity.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';

export interface CreatePublicationInput {
  readonly brandId: string;
  readonly userId: string;
  readonly originalPrompt?: string;
  readonly copy: string;
  readonly mediaUrl: string;
  readonly mediaType?: PublicationMediaType;
}

/** Crea la publicación en DRAFT (ya generada por IA y editable). */
@Injectable()
export class CreatePublicationUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(BRANDS_REPOSITORY) private readonly brands: BrandsRepository,
  ) {}

  async execute(input: CreatePublicationInput): Promise<Publication> {
    const brand = await this.brands.findById(input.brandId);
    if (brand === null) {
      throw new BrandNotFoundError(input.brandId);
    }
    return this.publications.create({
      brandId: input.brandId,
      userId: input.userId,
      originalPrompt: input.originalPrompt ?? '',
      copy: input.copy,
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType,
    });
  }
}
