import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { PublicationTarget, TargetPlatform, TargetStatus } from '../domain/target.entity.js';
import type { PublicationTargetsRepository } from '../domain/ports/publication-targets.repository.js';

/** Adaptador Prisma de `PublicationTargetsRepository`. */
@Injectable()
export class PrismaPublicationTargetsRepository implements PublicationTargetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPublication(publicationId: string): Promise<PublicationTarget[]> {
    const rows = await this.prisma.client.publicationTarget.findMany({
      where: { publicationId },
      orderBy: { platform: 'asc' },
    });
    return rows.map(toDomainTarget);
  }

  async add(publicationId: string, platform: TargetPlatform): Promise<PublicationTarget> {
    const row = await this.prisma.client.publicationTarget.create({
      data: { publicationId, platform },
    });
    return toDomainTarget(row);
  }

  async remove(publicationId: string, platform: TargetPlatform): Promise<boolean> {
    const deleted = await this.prisma.client.publicationTarget.deleteMany({
      where: { publicationId, platform },
    });
    return deleted.count > 0;
  }
}

interface TargetRow {
  readonly id: string;
  readonly publicationId: string;
  readonly platform: string;
  readonly status: string;
  readonly externalPostId: string | null;
  readonly externalPostUrl: string | null;
  readonly errorMessage: string | null;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toDomainTarget(row: TargetRow): PublicationTarget {
  return {
    id: row.id,
    publicationId: row.publicationId,
    platform: toDomainPlatform(row.platform),
    status: toDomainStatus(row.status),
    externalPostId: row.externalPostId,
    externalPostUrl: row.externalPostUrl,
    errorMessage: row.errorMessage,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDomainPlatform(value: string): TargetPlatform {
  if (value === 'FACEBOOK' || value === 'INSTAGRAM' || value === 'LINKEDIN' || value === 'TIKTOK') {
    return value;
  }
  throw new Error(`[publications] Unknown platform in database: ${value}`);
}

function toDomainStatus(value: string): TargetStatus {
  if (value === 'PENDING' || value === 'SUCCESS' || value === 'FAILED') {
    return value;
  }
  throw new Error(`[publications] Unknown target status in database: ${value}`);
}
