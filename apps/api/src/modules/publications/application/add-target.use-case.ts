import { Inject, Injectable } from '@nestjs/common';
import {
  InvalidTargetFormatError,
  PublicationTargetAlreadyAttachedError,
} from '../../../shared/errors.js';
import {
  defaultTargetFormat,
  isTargetFormatValid,
  type PublicationTarget,
  type TargetFormat,
  type TargetPlatform,
} from '../domain/target.entity.js';
import type { Requester } from '../domain/publication.entity.js';
import {
  PUBLICATION_TARGETS_REPOSITORY,
  type PublicationTargetsRepository,
} from '../domain/ports/publication-targets.repository.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';
import {
  loadForUpdate,
  requireOwnerOrAdmin,
  requireTargetsEditable,
} from './flow-helpers.js';

export interface AddTargetInput {
  readonly publicationId: string;
  readonly platform: TargetPlatform;
  readonly format?: TargetFormat;
  readonly requester: Requester;
}

/** Adjunta un canal (dueño o admin, solo antes de programar). */
@Injectable()
export class AddTargetUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_TARGETS_REPOSITORY) private readonly targets: PublicationTargetsRepository,
  ) {}

  async execute(input: AddTargetInput): Promise<PublicationTarget> {
    const publication = await loadForUpdate(this.publications, input.publicationId);
    requireOwnerOrAdmin(publication, input.requester);
    requireTargetsEditable(publication);
    const existing = await this.targets.findByPublication(input.publicationId);
    if (existing.some((target) => target.platform === input.platform)) {
      throw new PublicationTargetAlreadyAttachedError(input.publicationId, input.platform);
    }
    const format = input.format ?? defaultTargetFormat(publication.mediaType, input.platform);
    if (!isTargetFormatValid(publication.mediaType, input.platform, format)) {
      throw new InvalidTargetFormatError(
        `${format} is not valid for ${publication.mediaType} content on ${input.platform}`,
      );
    }
    return this.targets.add(input.publicationId, input.platform, format);
  }
}
