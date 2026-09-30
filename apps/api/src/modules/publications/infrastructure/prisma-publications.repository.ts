import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type {
  Publication,
  PublicationMediaType,
  PublicationStatus,
} from '../domain/publication.entity.js';
import type {
  CreatePublicationData,
  PublicationFilters,
  PublicationsRepository,
  UpdatePublicationData,
} from '../domain/ports/publications.repository.js';
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
        copy: data.copy,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType ?? 'IMAGE',
      },
    });
    return toDomainPublication(row);
  }

  async update(id: string, data: UpdatePublicationData): Promise<Publication> {
    const row = await this.prisma.client.publication.update({
      where: { id },
      data: {
        originalPrompt: data.originalPrompt,
        copy: data.copy,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        status: data.status,
        scheduledAt: data.scheduledAt,
        approvedById: data.approvedById,
        approvedAt: data.approvedAt,
        dispatchedAt: data.dispatchedAt,
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

  async markProcessing(id: string): Promise<boolean> {
    const claimed = await this.prisma.client.publication.updateMany({
      where: { id, status: 'SCHEDULED' },
      data: { status: 'PROCESSING', dispatchedAt: new Date() },
    });
    return claimed.count > 0;
  }
}

interface PublicationRow {
  readonly id: string;
  readonly brandId: string;
  readonly userId: string;
  readonly approvedById: string | null;
  readonly approvedAt: Date | null;
  readonly originalPrompt: string;
  readonly systemPrompt: string | null;
  readonly modelText: string;
  readonly modelMedia: string | null;
  readonly tokensUsed: number | null;
  readonly copy: string;
  readonly mediaUrl: string;
  readonly mediaType: string;
  readonly status: string;
  readonly scheduledAt: Date | null;
  readonly dispatchedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toDomainPublication(row: PublicationRow): Publication {
  return {
    id: row.id,
    brandId: row.brandId,
    userId: row.userId,
    approvedById: row.approvedById,
    approvedAt: row.approvedAt,
    originalPrompt: row.originalPrompt,
    systemPrompt: row.systemPrompt,
    modelText: row.modelText,
    modelMedia: row.modelMedia,
    tokensUsed: row.tokensUsed,
    copy: row.copy,
    mediaUrl: row.mediaUrl,
    mediaType: toDomainMediaType(row.mediaType),
    status: toDomainStatus(row.status),
    scheduledAt: row.scheduledAt,
    dispatchedAt: row.dispatchedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDomainMediaType(value: string): PublicationMediaType {
  if (value === 'IMAGE' || value === 'VIDEO') {
    return value;
  }
  throw new Error(`[publications] Unknown mediaType in database: ${value}`);
}

function toDomainStatus(value: string): PublicationStatus {
  switch (value) {
    case 'DRAFT':
    case 'PENDING_APPROVAL':
    case 'SCHEDULED':
    case 'PROCESSING':
    case 'PUBLISHED':
    case 'PARTIAL':
    case 'FAILED':
      return value;
    default:
      throw new Error(`[publications] Unknown status in database: ${value}`);
  }
}
