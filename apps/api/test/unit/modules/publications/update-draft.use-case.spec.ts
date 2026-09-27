import { InvalidPublicationTransitionError } from '../../../../src/shared/errors.js';
import { UpdateDraftUseCase } from '../../../../src/modules/publications/application/update-draft.use-case.js';
import {
  BASE_PUBLICATION,
  MARKETING,
  stubPublicationsRepository,
} from './test-stubs.js';

const PENDING = { ...BASE_PUBLICATION, status: 'PENDING_APPROVAL' as const };

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
