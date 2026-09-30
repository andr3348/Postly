import { ForbiddenError, PublicationNotFoundError, PublicationTargetNotFoundError } from '../../../shared/errors.js';
import { isAdmin, isOwner, type Publication, type Requester } from '../domain/publication.entity.js';
import type { TargetPlatform, PublicationTarget } from '../domain/target.entity.js';
import type { PublicationsRepository } from '../domain/ports/publications.repository.js';
import type { PublicationTargetsRepository } from '../domain/ports/publication-targets.repository.js';

export interface FlowInput {
  readonly id: string;
  readonly requester: Requester;
}

/** Carga o 404. Compartido por los casos de uso del módulo. */
export async function loadForUpdate(
  publications: PublicationsRepository,
  id: string,
): Promise<Publication> {
  const publication = await publications.findById(id);
  if (publication === null) {
    throw new PublicationNotFoundError(id);
  }
  return publication;
}

/** Dueño o admin; el resto recibe 403. */
export function requireOwnerOrAdmin(publication: Publication, requester: Requester): void {
  if (!isOwner(publication, requester) && !isAdmin(requester)) {
    throw new ForbiddenError('Only the author or an admin can modify this publication');
  }
}

/** Destino por plataforma o 404. */
export async function findTargetOrThrow(
  targets: PublicationTargetsRepository,
  publicationId: string,
  platform: TargetPlatform,
): Promise<PublicationTarget> {
  const all = await targets.findByPublication(publicationId);
  const target = all.find((candidate) => candidate.platform === platform);
  if (target === undefined) {
    throw new PublicationTargetNotFoundError(publicationId, platform);
  }
  return target;
}
