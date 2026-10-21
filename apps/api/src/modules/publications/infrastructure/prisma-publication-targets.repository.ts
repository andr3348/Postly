import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type {
  PublicationTarget,
  TargetFormat,
  TargetPlatform,
} from '../domain/target.entity.js';
import type { PublicationTargetsRepository, UpdateTargetData } from '../domain/ports/publication-targets.repository.js';
import { toDomainTarget, toPrismaFailure } from './prisma-publication-mappers.js';

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

  async add(
    publicationId: string,
    platform: TargetPlatform,
    format: TargetFormat,
  ): Promise<PublicationTarget> {
    const row = await this.prisma.client.publicationTarget.create({
      data: { publicationId, platform, format },
    });
    return toDomainTarget(row);
  }

  async updateFormat(id: string, format: TargetFormat): Promise<PublicationTarget> {
    const row = await this.prisma.client.publicationTarget.update({
      where: { id },
      data: { format },
    });
    return toDomainTarget(row);
  }

  async remove(publicationId: string, platform: TargetPlatform): Promise<boolean> {
    const deleted = await this.prisma.client.publicationTarget.deleteMany({
      where: { publicationId, platform },
    });
    return deleted.count > 0;
  }

  async findById(id: string): Promise<PublicationTarget | null> {
    const row = await this.prisma.client.publicationTarget.findUnique({ where: { id } });
    return row === null ? null : toDomainTarget(row);
  }

  async updateTarget(id: string, data: UpdateTargetData): Promise<PublicationTarget> {
    const row = await this.prisma.client.publicationTarget.update({
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
  }
}
