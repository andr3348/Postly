import type { PublicationTarget, TargetPlatform, TargetStatus } from '../target.entity.js';

/** Patch parcial de un destino (lo escribe n8n al reportar). */
export interface UpdateTargetData {
  readonly status?: TargetStatus;
  readonly externalPostId?: string;
  readonly externalPostUrl?: string;
  readonly errorMessage?: string;
  readonly publishedAt?: Date;
}

/**
 * Puerto de persistencia de destinos. La unicidad [publicationId, platform]
 * la garantiza la BD; el caso de uso la verifica antes para un 409 limpio.
 */
export interface PublicationTargetsRepository {
  findById(id: string): Promise<PublicationTarget | null>;
  findByPublication(publicationId: string): Promise<PublicationTarget[]>;
  add(publicationId: string, platform: TargetPlatform): Promise<PublicationTarget>;
  remove(publicationId: string, platform: TargetPlatform): Promise<boolean>;
  updateTarget(id: string, data: UpdateTargetData): Promise<PublicationTarget>;
}

export const PUBLICATION_TARGETS_REPOSITORY: unique symbol = Symbol(
  'PublicationTargetsRepository',
);
