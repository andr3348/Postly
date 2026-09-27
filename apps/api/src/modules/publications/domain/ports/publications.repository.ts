import type {
  Publication,
  PublicationMediaType,
  PublicationStatus,
} from '../publication.entity.js';

export interface PublicationFilters {
  readonly brandId?: string;
  readonly userId?: string;
  readonly status?: PublicationStatus;
}

export interface CreatePublicationData {
  readonly brandId: string;
  readonly userId: string;
  readonly originalPrompt: string;
  readonly copy: string;
  readonly mediaUrl: string;
  readonly mediaType?: PublicationMediaType;
}

export interface UpdatePublicationData {
  readonly originalPrompt?: string;
  readonly copy?: string;
  readonly mediaUrl?: string;
  readonly mediaType?: PublicationMediaType;
  readonly status?: PublicationStatus;
  readonly scheduledAt?: Date | null;
  readonly approvedById?: string | null;
  readonly approvedAt?: Date | null;
  readonly dispatchedAt?: Date | null;
}

/**
 * Puerto de persistencia de publicaciones.
 * El adaptador vive en `infrastructure/` (hoy: Prisma).
 */
export interface PublicationsRepository {
  findById(id: string): Promise<Publication | null>;
  findMany(filters: PublicationFilters): Promise<Publication[]>;
  create(data: CreatePublicationData): Promise<Publication>;
  update(id: string, data: UpdatePublicationData): Promise<Publication>;
}

export const PUBLICATIONS_REPOSITORY: unique symbol = Symbol('PublicationsRepository');
