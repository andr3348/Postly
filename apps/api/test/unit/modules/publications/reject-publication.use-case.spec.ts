import { ForbiddenError } from '../../../../src/shared/errors.js';
import { RejectPublicationUseCase } from '../../../../src/modules/publications/application/reject-publication.use-case.js';
import {
  ADMIN,
  BASE_PUBLICATION,
  MARKETING,
  stubPublicationsRepository,
} from './test-stubs.js';

const PENDING = { ...BASE_PUBLICATION, status: 'PENDING_APPROVAL' as const };

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
