import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { Publication } from '../domain/publication.entity.js';
import type {
  CreatePublicationData,
  PublicationFilters,
  PublicationsRepository,
  UpdatePublicationData,
} from '../domain/ports/publications.repository.js';
import { toDomainPublication } from './prisma-publication-mappers.js';

/**
 * Adaptador Prisma de `PublicationsRepository`.
 * Único lugar del módulo que conoce al cliente generado.
 */
@Injectable()
export class PrismaPublicationsRepository implements PublicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Publication | null> {
    const row = await this.prisma.client.publication.findUnique({ where: { id } });
    return row === null ? null : toDomainPublication(row);
  }

  async findMany(filters: PublicationFilters): Promise<Publication[]> {
    const rows = await this.prisma.client.publication.findMany({
      where: {
        brandId: filters.brandId,
        userId: filters.userId,
        status: filters.status,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomainPublication);
  }

  async create(data: CreatePublicationData): Promise<Publication> {
    const row = await this.prisma.client.publication.create({
      data: {
        brandId: data.brandId,
        userId: data.userId,
        originalPrompt: data.originalPrompt,
        title: data.title,
        copy: data.copy,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType ?? 'IMAGE',
        modelText: data.modelText,
        modelMedia: data.modelMedia,
        tokensUsed: data.tokensUsed,
      },
    });
    return toDomainPublication(row);
  }

  async update(id: string, data: UpdatePublicationData): Promise<Publication> {
    const row = await this.prisma.client.publication.update({
      where: { id },
      data: {
        originalPrompt: data.originalPrompt,
        title: data.title,
        copy: data.copy,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        status: data.status,
        scheduledAt: data.scheduledAt,
        approvedById: data.approvedById,
        approvedAt: data.approvedAt,
        dispatchedAt: data.dispatchedAt,
        dispatchAttemptId: data.dispatchAttemptId,
      },
    });
    return toDomainPublication(row);
  }

  async findDueDispatch(limit: number, now: Date): Promise<Publication[]> {
    const rows = await this.prisma.client.publication.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
    return rows.map(toDomainPublication);
  }

  async markProcessing(id: string, dispatchAttemptId: string, now: Date): Promise<boolean> {
    const claimed = await this.prisma.client.publication.updateMany({
      where: { id, status: 'SCHEDULED' },
      data: {
        status: 'PROCESSING',
        dispatchedAt: now,
        dispatchAttemptId,
      },
    });
    return claimed.count > 0;
  }

  async findStaleProcessing(olderThan: Date, limit: number): Promise<Publication[]> {
    const rows = await this.prisma.client.publication.findMany({
      where: { status: 'PROCESSING', dispatchedAt: { lt: olderThan } },
      orderBy: { dispatchedAt: 'asc' },
      take: limit,
    });
    return rows.map(toDomainPublication);
  }
}
