import { MetaOAuthError } from '../../../../src/shared/errors.js';
import { HandleMetaOAuthCallbackUseCase } from '../../../../src/modules/connected-accounts/application/handle-meta-oauth-callback.use-case.js';
import { hashMetaOAuthState } from '../../../../src/modules/connected-accounts/application/meta-oauth-state.js';
import {
  BASE_BRAND,
  BASE_PAGE,
  metaSession,
  stubMetaOAuthClient,
  stubMetaOAuthSessionsRepository,
} from './test-stubs.js';

const STATE = 'raw-state-1';

describe('HandleMetaOAuthCallbackUseCase', () => {
  it('marks the session ready and redirects with session and brand', async () => {
    const ready: string[] = [];
    const sessions = stubMetaOAuthSessionsRepository({
      findByStateHash: async (hash) =>
        hash === hashMetaOAuthState(STATE)
          ? metaSession({ status: 'PENDING', pages: null })
          : null,
      markReady: async (id) => {
        ready.push(id);
      },
    });
    const useCase = new HandleMetaOAuthCallbackUseCase(sessions, stubMetaOAuthClient());

    const result = await useCase.execute({ code: 'good-code', state: STATE });

    expect(ready).toEqual(['session-1']);
    expect(result.redirectUrl).toContain('/dashboard/accounts?');
    expect(result.redirectUrl).toContain('meta_session=session-1');
    expect(result.redirectUrl).toContain(`meta_brand=${BASE_BRAND.id}`);
  });

  it('marks the session failed when the user denies access', async () => {
    const failed: Array<{ code: string }> = [];
    const sessions = stubMetaOAuthSessionsRepository({
      findByStateHash: async () => metaSession({ status: 'PENDING', pages: null }),
      markFailed: async (_id, code) => {
        failed.push({ code });
      },
    });
    const useCase = new HandleMetaOAuthCallbackUseCase(sessions, stubMetaOAuthClient());

    const result = await useCase.execute({
      error: 'access_denied',
      errorDescription: 'User denied',
      state: STATE,
    });

    expect(failed).toEqual([{ code: 'META_OAUTH_DENIED' }]);
    expect(result.redirectUrl).toContain('meta_session=session-1');
  });

  it('redirects with a generic error when the state is unknown', async () => {
    const sessions = stubMetaOAuthSessionsRepository({
      findByStateHash: async () => null,
    });
    const useCase = new HandleMetaOAuthCallbackUseCase(sessions, stubMetaOAuthClient());

    const result = await useCase.execute({ code: 'code', state: 'unknown' });

    expect(result.redirectUrl).toContain('meta_error=expired');
  });

  it('does not consume a state twice', async () => {
    const sessions = stubMetaOAuthSessionsRepository({
      findByStateHash: async () => metaSession({ status: 'PENDING', pages: null }),
      consumeState: async () => false,
    });
    const useCase = new HandleMetaOAuthCallbackUseCase(sessions, stubMetaOAuthClient());

    const result = await useCase.execute({ code: 'code', state: STATE });

    expect(result.redirectUrl).toContain('meta_error=expired');
  });

  it('marks the session failed when the token exchange fails', async () => {
    const failed: Array<{ code: string }> = [];
    const sessions = stubMetaOAuthSessionsRepository({
      findByStateHash: async () => metaSession({ status: 'PENDING', pages: null }),
      markFailed: async (_id, code) => {
        failed.push({ code });
      },
    });
    const client = stubMetaOAuthClient({
      exchangeCodeForLongLivedUserToken: async () => {
        throw new MetaOAuthError('META_OAUTH_EXCHANGE_FAILED', 'código inválido');
      },
    });
    const useCase = new HandleMetaOAuthCallbackUseCase(sessions, client);

    const result = await useCase.execute({ code: 'bad-code', state: STATE });

    expect(failed).toEqual([{ code: 'META_OAUTH_EXCHANGE_FAILED' }]);
    expect(result.redirectUrl).toContain('meta_session=session-1');
  });

  it('marks the session failed when the account has no pages', async () => {
    const failed: Array<{ code: string }> = [];
    const sessions = stubMetaOAuthSessionsRepository({
      findByStateHash: async () => metaSession({ status: 'PENDING', pages: null }),
      markFailed: async (_id, code) => {
        failed.push({ code });
      },
    });
    const client = stubMetaOAuthClient({ listPages: async () => [] });
    const useCase = new HandleMetaOAuthCallbackUseCase(sessions, client);

    await useCase.execute({ code: 'code', state: STATE });

    expect(failed).toEqual([{ code: 'META_NO_PAGES' }]);
  });

  it('keeps pages out of the failure path', async () => {
    const pages = [BASE_PAGE];
    const readyPages: unknown[] = [];
    const sessions = stubMetaOAuthSessionsRepository({
      findByStateHash: async () => metaSession({ status: 'PENDING', pages: null }),
      markReady: async (_id, ready) => {
        readyPages.push(ready);
      },
    });
    const client = stubMetaOAuthClient({ listPages: async () => pages });
    const useCase = new HandleMetaOAuthCallbackUseCase(sessions, client);

    await useCase.execute({ code: 'code', state: STATE });

    expect(readyPages).toEqual([pages]);
  });
});
