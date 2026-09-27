import { Inject, Injectable } from '@nestjs/common';
import type { Brand } from '../domain/brand.entity.js';
import {
  BRANDS_REPOSITORY,
  type BrandsRepository,
  type UpdateBrandData,
} from '../domain/ports/brands.repository.js';
import { BrandNotFoundError } from '../../../shared/errors.js';

export interface UpdateBrandInput extends UpdateBrandData {
  readonly id: string;
}

@Injectable()
export class UpdateBrandUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY) private readonly brands: BrandsRepository,
  ) {}

  async execute(input: UpdateBrandInput): Promise<Brand> {
    const { id, ...data } = input;
    const existing = await this.brands.findById(id);
    if (!existing) throw new BrandNotFoundError(id);

    return this.brands.update(id, data);
  }
}
