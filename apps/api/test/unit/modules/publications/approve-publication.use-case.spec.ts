import {
  ForbiddenError,
  InvalidPublicationTransitionError,
} from '../../../../src/shared/errors.js';
import { ApprovePublicationUseCase } from '../../../../src/modules/publications/application/approve-publication.use-case.js';
import {
  ADMIN,
  BASE_PUBLICATION,
  MARKETING,
  stubPublicationsRepository,
} from './test-stubs.js';

const PENDING = { ...BASE_PUBLICATION, status: 'PENDING_APPROVAL' as const };

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
