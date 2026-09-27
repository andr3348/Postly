import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module.js';
import { CreateBrandUseCase } from './application/create-brand.use-case.js';
import { GetBrandsUseCase } from './application/get-brands.use-case.js';
import { GetBrandUseCase } from './application/get-brand.use-case.js';
import { UpdateBrandUseCase } from './application/update-brand.use-case.js';
import { DeleteBrandUseCase } from './application/delete-brand.use-case.js';
import { BRANDS_REPOSITORY } from './domain/ports/brands.repository.js';
import { PrismaBrandsRepository } from './infrastructure/prisma-brands.repository.js';
import { BrandController } from './presentation/brand.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [BrandController],
  providers: [
    CreateBrandUseCase,
    GetBrandsUseCase,
    GetBrandUseCase,
    UpdateBrandUseCase,
    DeleteBrandUseCase,
    { provide: BRANDS_REPOSITORY, useClass: PrismaBrandsRepository },
  ],
  // El puerto se comparte (p. ej. Publications verifica la marca al crear).
  exports: [BRANDS_REPOSITORY],
})
export class BrandModule {}
