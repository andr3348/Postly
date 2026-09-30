import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module.js';
import { BrandModule } from '../brand/brand.module.js';
import { CreatePublicationUseCase } from './application/create-publication.use-case.js';
import { UpdateDraftUseCase } from './application/update-draft.use-case.js';
import { SubmitPublicationUseCase } from './application/submit-publication.use-case.js';
import { ApprovePublicationUseCase } from './application/approve-publication.use-case.js';
import { RejectPublicationUseCase } from './application/reject-publication.use-case.js';
import { GetPublicationUseCase } from './application/get-publication.use-case.js';
import { ListPublicationsUseCase } from './application/list-publications.use-case.js';
import { AddTargetUseCase } from './application/add-target.use-case.js';
import { ListTargetsUseCase } from './application/list-targets.use-case.js';
import { RemoveTargetUseCase } from './application/remove-target.use-case.js';
import { RecordMetricUseCase } from './application/record-metric.use-case.js';
import { ListMetricsUseCase } from './application/list-metrics.use-case.js';
import { PUBLICATIONS_REPOSITORY } from './domain/ports/publications.repository.js';
import { PUBLICATION_METRICS_REPOSITORY } from './domain/ports/publication-metrics.repository.js';
import { PUBLICATION_TARGETS_REPOSITORY } from './domain/ports/publication-targets.repository.js';
import { PrismaPublicationsRepository } from './infrastructure/prisma-publications.repository.js';
import { PrismaPublicationMetricsRepository } from './infrastructure/prisma-publication-metrics.repository.js';
import { PrismaPublicationTargetsRepository } from './infrastructure/prisma-publication-targets.repository.js';
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
    AddTargetUseCase,
    ListTargetsUseCase,
    RemoveTargetUseCase,
    RecordMetricUseCase,
    ListMetricsUseCase,
    { provide: PUBLICATIONS_REPOSITORY, useClass: PrismaPublicationsRepository },
    { provide: PUBLICATION_TARGETS_REPOSITORY, useClass: PrismaPublicationTargetsRepository },
    { provide: PUBLICATION_METRICS_REPOSITORY, useClass: PrismaPublicationMetricsRepository },
  ],
})
export class PublicationsModule {}
