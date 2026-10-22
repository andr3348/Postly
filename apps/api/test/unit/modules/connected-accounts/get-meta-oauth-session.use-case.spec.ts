import { GetMetaOAuthSessionUseCase } from '../../../../src/modules/connected-accounts/application/get-meta-oauth-session.use-case.js';
import {
  BASE_BRAND,
  metaSession,
  stubBrandsRepository,
  stubMetaOAuthSessionsRepository,
} from './test-stubs.js';

describe('GetMetaOAuthSessionUseCase', () => {
  it('returns pages without Page tokens', async () => {
    const sessions = stubMetaOAuthSessionsRepository({
      getSession: async () => metaSession(),
    });
    const useCase = new GetMetaOAuthSessionUseCase(stubBrandsRepository(), sessions);

    const result = await useCase.execute({
      brandId: BASE_BRAND.id,
      userId: 'user-1',
      sessionId: 'session-1',
    });

    expect(result.status).toBe('READY');
    expect(result.pages).toEqual([
      { id: 'page-1', name: 'Página E2E', instagram: { id: 'ig-1', username: 'ig_e2e' } },
    ]);
    expect(result.pages[0]).not.toHaveProperty('accessToken');
  });

  it('exposes the failure reason for FAILED sessions', async () => {
    const sessions = stubMetaOAuthSessionsRepository({
      getSession: async () =>
        metaSession({
          status: 'FAILED',
          pages: null,
          errorCode: 'META_NO_PAGES',
          errorMessage: 'Sin páginas',
        }),
    });
    const useCase = new GetMetaOAuthSessionUseCase(stubBrandsRepository(), sessions);

    const result = await useCase.execute({
      brandId: BASE_BRAND.id,
      userId: 'user-1',
      sessionId: 'session-1',
    });

    expect(result).toMatchObject({
      status: 'FAILED',
      errorCode: 'META_NO_PAGES',
      errorMessage: 'Sin páginas',
      pages: [],
    });
  });

  it('hides sessions owned by another user', async () => {
    const sessions = stubMetaOAuthSessionsRepository({
      getSession: async () => metaSession({ userId: 'someone-else' }),
    });
    const useCase = new GetMetaOAuthSessionUseCase(stubBrandsRepository(), sessions);

    await expect(
      useCase.execute({ brandId: BASE_BRAND.id, userId: 'user-1', sessionId: 'session-1' }),
    ).rejects.toMatchObject({ code: 'META_OAUTH_SESSION_NOT_FOUND' });
  });
});
