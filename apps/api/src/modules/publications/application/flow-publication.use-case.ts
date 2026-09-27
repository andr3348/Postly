import { Inject, Injectable } from '@nestjs/common';
import {
  ForbiddenError,
  InvalidPublicationTransitionError,
  PublicationNotFoundError,
} from '../../../shared/errors.js';
import {
  canTransition,
  isAdmin,
  isOwner,
  type Publication,
  type PublicationMediaType,
  type Requester,
} from '../domain/publication.entity.js';
import {
  PUBLICATIONS_REPOSITORY,
  type PublicationsRepository,
} from '../domain/ports/publications.repository.js';

async function loadForUpdate(
  publications: PublicationsRepository,
  id: string,
): Promise<Publication> {
  const publication = await publications.findById(id);
  if (publication === null) {
    throw new PublicationNotFoundError(id);
  }
  return publication;
}

function requireOwnerOrAdmin(publication: Publication, requester: Requester): void {
  if (!isOwner(publication, requester) && !isAdmin(requester)) {
    throw new ForbiddenError('Only the author or an admin can modify this publication');
  }
}

export interface UpdateDraftInput {
  readonly id: string;
  readonly requester: Requester;
  readonly originalPrompt?: string;
  readonly copy?: string;
  readonly mediaUrl?: string;
  readonly mediaType?: PublicationMediaType;
}

/** Edita contenido solo mientras sea DRAFT (dueño o admin). */
@Injectable()
export class UpdateDraftUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
  ) {}

  async execute(input: UpdateDraftInput): Promise<Publication> {
    const publication = await loadForUpdate(this.publications, input.id);
    requireOwnerOrAdmin(publication, input.requester);
    if (publication.status !== 'DRAFT') {
      throw new InvalidPublicationTransitionError(publication.status, 'DRAFT (edit)');
    }
    return this.publications.update(input.id, {
      originalPrompt: input.originalPrompt,
      copy: input.copy,
      mediaUrl: input.mediaUrl,
      mediaType: input.mediaType,
    });
  }
}

export interface FlowInput {
  readonly id: string;
  readonly requester: Requester;
}

/** DRAFT → PENDING_APPROVAL (dueño o admin). */
@Injectable()
export class SubmitPublicationUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
  ) {}

  async execute(input: FlowInput): Promise<Publication> {
    const publication = await loadForUpdate(this.publications, input.id);
    requireOwnerOrAdmin(publication, input.requester);
    if (!canTransition(publication.status, 'PENDING_APPROVAL')) {
      throw new InvalidPublicationTransitionError(publication.status, 'PENDING_APPROVAL');
    }
    return this.publications.update(input.id, { status: 'PENDING_APPROVAL' });
  }
}

export interface ApprovePublicationInput extends FlowInput {
  readonly scheduledAt: Date;
}

/** PENDING_APPROVAL → SCHEDULED (solo admin; fija auditoría y agenda). */
@Injectable()
export class ApprovePublicationUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
  ) {}

  async execute(input: ApprovePublicationInput): Promise<Publication> {
    const publication = await loadForUpdate(this.publications, input.id);
    if (!isAdmin(input.requester)) {
      throw new ForbiddenError('Only an admin can approve publications');
    }
    if (!canTransition(publication.status, 'SCHEDULED')) {
      throw new InvalidPublicationTransitionError(publication.status, 'SCHEDULED');
    }
    return this.publications.update(input.id, {
      status: 'SCHEDULED',
      scheduledAt: input.scheduledAt,
      approvedById: input.requester.id,
      approvedAt: new Date(),
    });
  }
}

/** PENDING_APPROVAL → DRAFT (solo admin; devuelve a edición). */
@Injectable()
export class RejectPublicationUseCase {
  constructor(
    @Inject(PUBLICATIONS_REPOSITORY) private readonly publications: PublicationsRepository,
  ) {}

  async execute(input: FlowInput): Promise<Publication> {
    const publication = await loadForUpdate(this.publications, input.id);
    if (!isAdmin(input.requester)) {
      throw new ForbiddenError('Only an admin can reject publications');
    }
    if (!canTransition(publication.status, 'DRAFT')) {
      throw new InvalidPublicationTransitionError(publication.status, 'DRAFT');
    }
    return this.publications.update(input.id, { status: 'DRAFT' });
  }
}
