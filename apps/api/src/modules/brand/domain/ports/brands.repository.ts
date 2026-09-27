import type { Brand } from '../brand.entity.js';

export interface CreateBrandData {
  readonly name: string;
  readonly logoUrl?: string | null;
  readonly websiteUrl?: string | null;
  readonly aiTone?: string;
  readonly aiBrandVoice?: string | null;
  readonly aiTargetAudience?: string | null;
  readonly defaultHashtags?: string[];
}

export interface UpdateBrandData {
  readonly name?: string;
  readonly logoUrl?: string | null;
  readonly websiteUrl?: string | null;
  readonly aiTone?: string;
  readonly aiBrandVoice?: string | null;
  readonly aiTargetAudience?: string | null;
  readonly defaultHashtags?: string[];
}

export interface BrandsRepository {
  findById(id: string): Promise<Brand | null>;
  findAll(): Promise<Brand[]>;
  create(data: CreateBrandData): Promise<Brand>;
  update(id: string, data: UpdateBrandData): Promise<Brand>;
  delete(id: string): Promise<void>;
}

export const BRANDS_REPOSITORY: unique symbol = Symbol('BrandsRepository');
