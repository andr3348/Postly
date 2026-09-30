import { MissingConnectedAccountError } from '../../../../src/shared/errors.js';
import { ClaimDispatchUseCase } from '../../../../src/modules/dispatch/application/claim-dispatch.use-case.js';
import {
  BASE_CREDENTIALS,
  BASE_PUBLICATION,
  BASE_TARGET,
  stubDispatchCredentials,
  stubPublicationTargetsRepository,
  stubPublicationsRepository,
} from './test-stubs.js';

describe('ClaimDispatchUseCase', () => {
  function arrange(options: {
    due?: typeof BASE_PUBLICATION[];
    targets?: typeof BASE_TARGET[];
    credentials?: typeof BASE_CREDENTIALS[];
    failCredentials?: Error;
    claimed?: boolean;
  } = {}) {
    const due = options.due ?? [BASE_PUBLICATION];
    const publications = stubPublicationsRepository({
      findDueDispatch: async () => due,
      findById: async (id) => due.find((publication) => publication.id === id) ?? null,
      markProcessing: async () => options.claimed ?? true,
    });
    const targets = stubPublicationTargetsRepository({
      findByPublication: async () => options.targets ?? [BASE_TARGET],
    });
    const credentials = stubDispatchCredentials({
      getForDispatch:
        options.failCredentials === undefined
          ? async () => options.credentials ?? [BASE_CREDENTIALS]
          : async () => {
              throw options.failCredentials;
            },
    });
    return new ClaimDispatchUseCase(publications, targets, credentials);
  }

  it('claims the next due publication with credentials', async () => {
    const claim = await arrange().execute(new Date());

    expect(claim?.publication.id).toBe(BASE_PUBLICATION.id);
    expect(claim?.targets).toHaveLength(1);
    expect(claim?.targets[0]?.credentials.accessToken).toBe('decrypted-access');
  });

  it('returns null when nothing is due', async () => {
    await expect(arrange({ due: [] }).execute(new Date())).resolves.toBeNull();
  });

  it('skips publications without pending targets', async () => {
    const success = { ...BASE_TARGET, status: 'SUCCESS' as const };

    await expect(
      arrange({ targets: [success] }).execute(new Date()),
    ).resolves.toBeNull();
  });

  it('does not claim when credentials are missing', async () => {
    const marked: string[] = [];
    const publications = stubPublicationsRepository({
      findDueDispatch: async () => [BASE_PUBLICATION],
      markProcessing: async (id) => {
        marked.push(id);
        return true;
      },
    });
    const targets = stubPublicationTargetsRepository({
      findByPublication: async () => [BASE_TARGET],
    });
    const credentials = stubDispatchCredentials({
      getForDispatch: async () => {
        throw new MissingConnectedAccountError('brand-1', ['LINKEDIN']);
      },
    });
    const useCase = new ClaimDispatchUseCase(publications, targets, credentials);

    await expect(useCase.execute(new Date())).rejects.toBeInstanceOf(
      MissingConnectedAccountError,
    );
    expect(marked).toEqual([]);
  });

  it('tries the next one when a worker took it first', async () => {
    const second = { ...BASE_PUBLICATION, id: 'pub-2' };
    const marked: string[] = [];
    const due = [BASE_PUBLICATION, second];
    const publications = stubPublicationsRepository({
      findDueDispatch: async () => due,
      findById: async (id) => due.find((publication) => publication.id === id) ?? null,
      markProcessing: async (id) => {
        marked.push(id);
        return id === 'pub-2';
      },
    });
    const targets = stubPublicationTargetsRepository({
      findByPublication: async () => [BASE_TARGET],
    });
    const useCase = new ClaimDispatchUseCase(
      publications,
      targets,
      stubDispatchCredentials(),
    );

    const claim = await useCase.execute(new Date());

    expect(claim?.publication.id).toBe('pub-2');
    expect(marked).toEqual([BASE_PUBLICATION.id, 'pub-2']);
  });
});
