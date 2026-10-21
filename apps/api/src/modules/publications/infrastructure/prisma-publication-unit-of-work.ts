import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type {
  PublicationTransaction,
  PublicationUnitOfWork,
} from '../domain/ports/publication-unit-of-work.port.js';
import {
  toDomainMetric,
  toDomainPublication,
  toDomainTarget,
  toPrismaFailure,
} from './prisma-publication-mappers.js';

/**
 * Implementación Prisma del unit of work. Cada `run` abre una transacción y
 * expone un `PublicationTransaction` que siempre bloquea la publicación antes
 * de leer o escribir sus destinos.
 */
@Injectable()
export class PrismaPublicationUnitOfWork implements PublicationUnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (tx: PublicationTransaction) => Promise<T>): Promise<T> {
    return this.prisma.client.$transaction(
      async (tx) => {
        const transaction: PublicationTransaction = {
          lockPublication: async (id) => {
            await tx.$queryRaw`SELECT "id" FROM "Publication" WHERE "id" = ${id} FOR UPDATE`;
            const row = await tx.publication.findUnique({ where: { id } });
            return row === null ? null : toDomainPublication(row);
          },
          findPublication: async (id) => {
            const row = await tx.publication.findUnique({ where: { id } });
            return row === null ? null : toDomainPublication(row);
          },
          findTarget: async (id) => {
            const row = await tx.publicationTarget.findUnique({ where: { id } });
            return row === null ? null : toDomainTarget(row);
          },
          findTargets: async (publicationId) => {
            const rows = await tx.publicationTarget.findMany({
              where: { publicationId },
              orderBy: { platform: 'asc' },
            });
            return rows.map(toDomainTarget);
          },
          updateTarget: async (id, data) => {
            const row = await tx.publicationTarget.update({
              where: { id },
              data: {
                status: data.status,
                externalPostId: data.externalPostId,
                externalPostUrl: data.externalPostUrl,
                errorMessage: data.errorMessage,
                failure: toPrismaFailure(data.failure),
                retryCount: data.retryCount,
                publishedAt: data.publishedAt,
              },
            });
            return toDomainTarget(row);
          },
          updatePublication: async (id, data) => {
            const row = await tx.publication.update({
              where: { id },
              data: {
                status: data.status,
                scheduledAt: data.scheduledAt,
                approvedById: data.approvedById,
                approvedAt: data.approvedAt,
                dispatchedAt: data.dispatchedAt,
                dispatchAttemptId: data.dispatchAttemptId,
              },
            });
            return toDomainPublication(row);
          },
          recordMetric: async (targetId, snapshot) => {
            const row = await tx.targetMetric.create({
              data: {
                publicationTargetId: targetId,
                impressions: snapshot.impressions ?? 0,
                likes: snapshot.likes ?? 0,
                comments: snapshot.comments ?? 0,
                shares: snapshot.shares ?? 0,
                clicks: snapshot.clicks ?? 0,
              },
            });
            return toDomainMetric(row);
          },
        };
        return work(transaction);
      },
      { maxWait: 5_000, timeout: 10_000 },
    );
  }
}
