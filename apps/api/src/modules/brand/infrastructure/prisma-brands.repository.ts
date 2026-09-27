import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { Brand } from '../domain/brand.entity.js';
import type {
  CreateBrandData,
  UpdateBrandData,
  BrandsRepository,
} from '../domain/ports/brands.repository.js';

@Injectable()
export class PrismaBrandsRepository implements BrandsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Brand | null> {
    const row = await this.prisma.client.brand.findUnique({ where: { id } });
    return row === null ? null : toDomainBrand(row);
  }

  async findAll(): Promise<Brand[]> {
    const rows = await this.prisma.client.brand.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomainBrand);
  }

  async create(data: CreateBrandData): Promise<Brand> {
    const row = await this.prisma.client.brand.create({
      data: {
        name: data.name,
        logoUrl: data.logoUrl,
        websiteUrl: data.websiteUrl,
        aiTone: data.aiTone,
        aiBrandVoice: data.aiBrandVoice,
        aiTargetAudience: data.aiTargetAudience,
        defaultHashtags: data.defaultHashtags ?? [],
      },
    });
    return toDomainBrand(row);
  }

  async update(id: string, data: UpdateBrandData): Promise<Brand> {
    const row = await this.prisma.client.brand.update({
      where: { id },
      data: {
        name: data.name,
        logoUrl: data.logoUrl,
        websiteUrl: data.websiteUrl,
        aiTone: data.aiTone,
        aiBrandVoice: data.aiBrandVoice,
        aiTargetAudience: data.aiTargetAudience,
        defaultHashtags: data.defaultHashtags,
      },
    });
    return toDomainBrand(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.client.brand.delete({
      where: { id },
    });
  }
}

interface BrandRow {
  readonly id: string;
  readonly name: string;
  readonly logoUrl: string | null;
  readonly websiteUrl: string | null;
  readonly aiTone: string;
  readonly aiBrandVoice: string | null;
  readonly aiTargetAudience: string | null;
  readonly defaultHashtags: string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toDomainBrand(row: BrandRow): Brand {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logoUrl,
    websiteUrl: row.websiteUrl,
    aiTone: row.aiTone,
    aiBrandVoice: row.aiBrandVoice,
    aiTargetAudience: row.aiTargetAudience,
    defaultHashtags: row.defaultHashtags,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
