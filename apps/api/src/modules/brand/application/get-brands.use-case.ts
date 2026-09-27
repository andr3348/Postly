import { Inject, Injectable } from '@nestjs/common';
import type { Brand } from '../domain/brand.entity.js';
import {
  BRANDS_REPOSITORY,
  type BrandsRepository,
} from '../domain/ports/brands.repository.js';

@Injectable()
export class GetBrandsUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY) private readonly brands: BrandsRepository,
  ) {}

  async execute(): Promise<Brand[]> {
    return this.brands.findAll();
  }
}
