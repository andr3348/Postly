import { Inject, Injectable } from '@nestjs/common';
import {
  BRANDS_REPOSITORY,
  type BrandsRepository,
} from '../domain/ports/brands.repository.js';
import { BrandNotFoundError } from '../../../shared/errors.js';

@Injectable()
export class DeleteBrandUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY) private readonly brands: BrandsRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.brands.findById(id);
    if (!existing) throw new BrandNotFoundError(id);

    await this.brands.delete(id);
  }
}
