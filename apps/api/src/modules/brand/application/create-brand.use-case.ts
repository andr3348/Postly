import { Inject, Injectable } from '@nestjs/common';
import type { Brand } from '../domain/brand.entity.js';
import {
  BRANDS_REPOSITORY,
  type BrandsRepository,
} from '../domain/ports/brands.repository.js';

export interface CreateBrandInput {
  readonly name: string;
  readonly logoUrl?: string | null;
  readonly websiteUrl?: string | null;
  readonly aiTone?: string;
  readonly aiBrandVoice?: string | null;
  readonly aiTargetAudience?: string | null;
  readonly defaultHashtags?: string[];
}

@Injectable()
export class CreateBrandUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY) private readonly brands: BrandsRepository,
  ) {}

  async execute(input: CreateBrandInput): Promise<Brand> {
    return this.brands.create({
      name: input.name,
      logoUrl: input.logoUrl,
      websiteUrl: input.websiteUrl,
      aiTone: input.aiTone,
      aiBrandVoice: input.aiBrandVoice,
      aiTargetAudience: input.aiTargetAudience,
      defaultHashtags: input.defaultHashtags,
    });
  }
}
