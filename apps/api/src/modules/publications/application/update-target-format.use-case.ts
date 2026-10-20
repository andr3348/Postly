import { Inject, Injectable } from '@nestjs/common';
import { InvalidTargetFormatError } from '../../../shared/errors.js';
import type { Requester } from '../domain/publication.entity.js';
import {
  isTargetFormatValid,
  type PublicationTarget,
  type TargetFormat,
  type TargetPlatform,
} from '../domain/target.entity.js';
import {
  PUBLICATION_TARGETS_REPOSITORY,
  type PublicationTargetsRepository,
} from '../domain/ports/publication-targets.repository.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';
import {
  findTargetOrThrow,
  loadForUpdate,
  requireOwnerOrAdmin,
  requireTargetsEditable,
} from './flow-helpers.js';

export interface UpdateTargetFormatInput {
  readonly publicationId: string;
  readonly platform: TargetPlatform;
  readonly format: TargetFormat;
  readonly requester: Requester;
}

/** Cambia Feed/Reel de un canal (dueño o admin, solo antes de programar). */
@Injectable()
export class UpdateTargetFormatUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
    @Inject(PUBLICATION_TARGETS_REPOSITORY) private readonly targets: PublicationTargetsRepository,
  ) {}

  async execute(input: UpdateTargetFormatInput): Promise<PublicationTarget> {
    const publication = await loadForUpdate(this.publications, input.publicationId);
    requireOwnerOrAdmin(publication, input.requester);
    requireTargetsEditable(publication);
    const target = await findTargetOrThrow(
      this.targets,
      input.publicationId,
      input.platform,
    );
    if (!isTargetFormatValid(publication.mediaType, target.platform, input.format)) {
      throw new InvalidTargetFormatError(
        `${input.format} is not valid for ${publication.mediaType} content on ${target.platform}`,
      );
    }
    return this.targets.updateFormat(target.id, input.format);
  }
}
