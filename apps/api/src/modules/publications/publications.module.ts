import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module.js';
import { BrandModule } from '../brand/brand.module.js';
import { CreatePublicationUseCase } from './application/create-publication.use-case.js';
import {
  ApprovePublicationUseCase,
  RejectPublicationUseCase,
  SubmitPublicationUseCase,
  UpdateDraftUseCase,
} from './application/flow-publication.use-case.js';
import {
  GetPublicationUseCase,
  ListPublicationsUseCase,
} from './application/query-publication.use-case.js';
import { PUBLICATIONS_REPOSITORY } from './domain/ports/publications.repository.js';
import { PrismaPublicationsRepository } from './infrastructure/prisma-publications.repository.js';
import { PublicationsController } from './presentation/publications.controller.js';

/**
 * Módulo publications: DRAFT → PENDING_APPROVAL → SCHEDULED (+ rechazo a DRAFT).
 * Importa `BrandModule` solo por el puerto `BRANDS_REPOSITORY` (verificar la
 * marca al crear); la autorización por rol vive en los casos de uso.
 */
@Module({
  imports: [PrismaModule, BrandModule],
  controllers: [PublicationsController],
  providers: [
    CreatePublicationUseCase,
    GetPublicationUseCase,
    ListPublicationsUseCase,
    UpdateDraftUseCase,
    SubmitPublicationUseCase,
    ApprovePublicationUseCase,
    RejectPublicationUseCase,
    { provide: PUBLICATIONS_REPOSITORY, useClass: PrismaPublicationsRepository },
  ],
})
export class PublicationsModule {}
