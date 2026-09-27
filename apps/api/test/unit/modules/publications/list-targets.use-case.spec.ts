import { PublicationNotFoundError } from '../../../../src/shared/errors.js';
import { ListTargetsUseCase } from '../../../../src/modules/publications/application/list-targets.use-case.js';
import {
  BASE_PUBLICATION,
  stubPublicationTargetsRepository,
  stubPublicationsRepository,
} from './test-stubs.js';

const PENDING = { ...BASE_PUBLICATION, status: 'PENDING_APPROVAL' as const };

describe('ListTargetsUseCase', () => {
  it('returns the attached channels', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => PENDING,
    });

    const targets = await new ListTargetsUseCase(
      publications,
      stubPublicationTargetsRepository(),
    ).execute(PENDING.id);

    expect(targets).toEqual([]);
  });

  it('throws PublicationNotFoundError when missing', async () => {
    await expect(
      new ListTargetsUseCase(
        stubPublicationsRepository(),
        stubPublicationTargetsRepository(),
      ).execute('missing'),
    ).rejects.toBeInstanceOf(PublicationNotFoundError);
  });
});
