import {
  ForbiddenError,
  InvalidPublicationTransitionError,
} from '../../../../src/shared/errors.js';
import { ApprovePublicationUseCase } from '../../../../src/modules/publications/application/approve-publication.use-case.js';
import { PublishNowUseCase } from '../../../../src/modules/publications/application/publish-now.use-case.js';
import type { PublicationsRepository } from '../../../../src/modules/publications/domain/ports/publications.repository.js';
import {
  ADMIN,
  BASE_PUBLICATION,
  MARKETING,
  stubPublicationsRepository,
} from './test-stubs.js';

const PENDING = { ...BASE_PUBLICATION, status: 'PENDING_APPROVAL' as const };

function buildUseCase(
  publications: PublicationsRepository = stubPublicationsRepository({
    findById: async () => PENDING,
  }),
) {
  const notifier = { notify: vi.fn(async () => {}) };
  const useCase = new PublishNowUseCase(
    new ApprovePublicationUseCase(publications),
    notifier,
  );
  return { useCase, notifier };
}

describe('PublishNowUseCase', () => {
  it('approves PENDING_APPROVAL with now and wakes n8n once', async () => {
    const before = Date.now();
    const { useCase, notifier } = buildUseCase();

    const publication = await useCase.execute({ id: PENDING.id, requester: ADMIN });

    const after = Date.now();
    expect(publication.status).toBe('SCHEDULED');
    expect(publication.approvedById).toBe(ADMIN.id);
    expect(publication.approvedAt).toBeInstanceOf(Date);
    expect(publication.scheduledAt).toBeInstanceOf(Date);
    const scheduledAt = publication.scheduledAt as Date;
    expect(scheduledAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(scheduledAt.getTime()).toBeLessThanOrEqual(after);
    expect(notifier.notify).toHaveBeenCalledTimes(1);
  });

  it('forbids MARKETING and does not wake n8n', async () => {
    const { useCase, notifier } = buildUseCase();

    await expect(
      useCase.execute({ id: PENDING.id, requester: MARKETING }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('rejects non-PENDING_APPROVAL and does not wake n8n', async () => {
    const { useCase, notifier } = buildUseCase(
      stubPublicationsRepository({ findById: async () => BASE_PUBLICATION }),
    );

    await expect(
      useCase.execute({ id: BASE_PUBLICATION.id, requester: ADMIN }),
    ).rejects.toBeInstanceOf(InvalidPublicationTransitionError);

    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('returns the publication when the webhook fails (cron fallback)', async () => {
    const notifier = {
      notify: vi.fn(async () => {
        throw new Error('n8n down');
      }),
    };
    const useCase = new PublishNowUseCase(
      new ApprovePublicationUseCase(
        stubPublicationsRepository({ findById: async () => PENDING }),
      ),
      notifier,
    );

    const publication = await useCase.execute({ id: PENDING.id, requester: ADMIN });

    expect(publication.status).toBe('SCHEDULED');
    expect(notifier.notify).toHaveBeenCalledTimes(1);
  });
});
