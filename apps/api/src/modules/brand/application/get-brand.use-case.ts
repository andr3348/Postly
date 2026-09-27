import { Inject, Injectable } from '@nestjs/common';
import type { Brand } from '../domain/brand.entity.js';
import {
  BRANDS_REPOSITORY,
  type BrandsRepository,
} from '../domain/ports/brands.repository.js';
import { BrandNotFoundError } from '../../../shared/errors.js';

@Injectable()
export class GetBrandUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY) private readonly brands: BrandsRepository,
  ) {}

  async execute(id: string): Promise<Brand> {
    const brand = await this.brands.findById(id);
    if (!brand) throw new BrandNotFoundError(id);
    return brand;
  }
}
