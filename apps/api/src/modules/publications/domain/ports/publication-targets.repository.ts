import type { PublicationTarget, TargetPlatform } from '../target.entity.js';

/**
 * Puerto de persistencia de destinos. La unicidad [publicationId, platform]
 * la garantiza la BD; el caso de uso la verifica antes para un 409 limpio.
 */
export interface PublicationTargetsRepository {
  findByPublication(publicationId: string): Promise<PublicationTarget[]>;
  add(publicationId: string, platform: TargetPlatform): Promise<PublicationTarget>;
  remove(publicationId: string, platform: TargetPlatform): Promise<boolean>;
}

export const PUBLICATION_TARGETS_REPOSITORY: unique symbol = Symbol(
  'PublicationTargetsRepository',
);
