import {
  ForbiddenError,
  InvalidPublicationTransitionError,
  PublicationNotFoundError,
} from '../../../../src/shared/errors.js';
import {
  ApprovePublicationUseCase,
  RejectPublicationUseCase,
  SubmitPublicationUseCase,
  UpdateDraftUseCase,
} from '../../../../src/modules/publications/application/flow-publication.use-case.js';
import {
  ADMIN,
  BASE_PUBLICATION,
  MARKETING,
  OTHER_MARKETING,
  stubPublicationsRepository,
} from './test-stubs.js';

const PENDING = { ...BASE_PUBLICATION, status: 'PENDING_APPROVAL' as const };

describe('SubmitPublicationUseCase', () => {
  it('moves DRAFT to PENDING_APPROVAL for the owner', async () => {
    const updated: string[] = [];
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
      update: async (id, data) => {
        updated.push(JSON.stringify(data));
        return { ...BASE_PUBLICATION, id, ...data };
      },
    });

    const publication = await new SubmitPublicationUseCase(publications).execute({
      id: BASE_PUBLICATION.id,
      requester: MARKETING,
    });

    expect(publication.status).toBe('PENDING_APPROVAL');
    expect(updated).toHaveLength(1);
  });

  it('forbids a non-owner non-admin', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
    });

    await expect(
      new SubmitPublicationUseCase(publications).execute({
        id: BASE_PUBLICATION.id,
        requester: OTHER_MARKETING,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects submit from a non-DRAFT status', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => PENDING,
    });

    await expect(
      new SubmitPublicationUseCase(publications).execute({
        id: PENDING.id,
        requester: MARKETING,
      }),
    ).rejects.toBeInstanceOf(InvalidPublicationTransitionError);
  });

  it('throws PublicationNotFoundError when missing', async () => {
    await expect(
      new SubmitPublicationUseCase(stubPublicationsRepository()).execute({
        id: 'missing',
        requester: MARKETING,
      }),
    ).rejects.toBeInstanceOf(PublicationNotFoundError);
  });
});

describe('ApprovePublicationUseCase', () => {
  const scheduledAt = new Date('2026-10-01T09:00:00Z');

  it('approves PENDING_APPROVAL as admin with audit + schedule', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => PENDING,
    });

    const publication = await new ApprovePublicationUseCase(publications).execute({
      id: PENDING.id,
      scheduledAt,
      requester: ADMIN,
    });

    expect(publication).toMatchObject({
      status: 'SCHEDULED',
      scheduledAt,
      approvedById: ADMIN.id,
    });
    expect(publication.approvedAt).toBeInstanceOf(Date);
  });

  it('forbids marketing from approving', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => PENDING,
    });

    await expect(
      new ApprovePublicationUseCase(publications).execute({
        id: PENDING.id,
        scheduledAt,
        requester: MARKETING,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects approve from DRAFT', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
    });

    await expect(
      new ApprovePublicationUseCase(publications).execute({
        id: BASE_PUBLICATION.id,
        scheduledAt,
        requester: ADMIN,
      }),
    ).rejects.toBeInstanceOf(InvalidPublicationTransitionError);
  });
});

describe('RejectPublicationUseCase', () => {
  it('returns PENDING_APPROVAL to DRAFT as admin', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => PENDING,
    });

    const publication = await new RejectPublicationUseCase(publications).execute({
      id: PENDING.id,
      requester: ADMIN,
    });

    expect(publication.status).toBe('DRAFT');
  });

  it('forbids marketing from rejecting', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => PENDING,
    });

    await expect(
      new RejectPublicationUseCase(publications).execute({
        id: PENDING.id,
        requester: MARKETING,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('UpdateDraftUseCase', () => {
  it('edits content while DRAFT', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
    });

    const publication = await new UpdateDraftUseCase(publications).execute({
      id: BASE_PUBLICATION.id,
      requester: MARKETING,
      copy: 'editado',
    });

    expect(publication.copy).toBe('editado');
  });

  it('rejects editing a non-DRAFT publication', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => PENDING,
    });

    await expect(
      new UpdateDraftUseCase(publications).execute({
        id: PENDING.id,
        requester: MARKETING,
        copy: 'x',
      }),
    ).rejects.toBeInstanceOf(InvalidPublicationTransitionError);
  });
});
