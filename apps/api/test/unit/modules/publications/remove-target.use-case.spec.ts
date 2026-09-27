import { PublicationTargetNotFoundError } from '../../../../src/shared/errors.js';
import { RemoveTargetUseCase } from '../../../../src/modules/publications/application/remove-target.use-case.js';
import {
  BASE_PUBLICATION,
  MARKETING,
  stubPublicationTargetsRepository,
  stubPublicationsRepository,
} from './test-stubs.js';

describe('RemoveTargetUseCase', () => {
  it('detaches an attached channel', async () => {
    const removed: string[] = [];
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
    });
    const targets = stubPublicationTargetsRepository({
      remove: async (publicationId, platform) => {
        removed.push(`${publicationId}:${platform}`);
        return true;
      },
    });

    await new RemoveTargetUseCase(publications, targets).execute({
      publicationId: BASE_PUBLICATION.id,
      platform: 'LINKEDIN',
      requester: MARKETING,
    });

    expect(removed).toEqual([`${BASE_PUBLICATION.id}:LINKEDIN`]);
  });

  it('throws PublicationTargetNotFoundError when not attached', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
    });
    const targets = stubPublicationTargetsRepository({ remove: async () => false });

    await expect(
      new RemoveTargetUseCase(publications, targets).execute({
        publicationId: BASE_PUBLICATION.id,
        platform: 'TIKTOK',
        requester: MARKETING,
      }),
    ).rejects.toBeInstanceOf(PublicationTargetNotFoundError);
  });
});
