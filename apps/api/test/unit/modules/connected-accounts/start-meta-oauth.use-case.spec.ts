import { MetaOAuthError, BrandNotFoundError } from '../../../../src/shared/errors.js';
import { StartMetaOAuthUseCase } from '../../../../src/modules/connected-accounts/application/start-meta-oauth.use-case.js';
import { hashMetaOAuthState } from '../../../../src/modules/connected-accounts/application/meta-oauth-state.js';
import type { CreateMetaOAuthSessionInput } from '../../../../src/modules/connected-accounts/domain/ports/meta-oauth-sessions.repository.js';
import {
  BASE_BRAND,
  metaSession,
  stubBrandsRepository,
  stubMetaOAuthClient,
  stubMetaOAuthSessionsRepository,
} from './test-stubs.js';

describe('StartMetaOAuthUseCase', () => {
  it('stores only the state hash and returns the dialog URL', async () => {
    const created: CreateMetaOAuthSessionInput[] = [];
    const invalidated: string[] = [];
    const sessions = stubMetaOAuthSessionsRepository({
      createSession: async (input) => {
        created.push(input);
        return metaSession({ status: 'PENDING', pages: null, ...input });
      },
      invalidateActiveSessions: async (brandId, userId) => {
        invalidated.push(`${brandId}:${userId}`);
      },
    });
    const useCase = new StartMetaOAuthUseCase(
      stubBrandsRepository(),
      sessions,
      stubMetaOAuthClient(),
    );

    const result = await useCase.execute({ brandId: BASE_BRAND.id, userId: 'user-1' });

    const rawState = new URL(result.authorizationUrl).searchParams.get('state');
    expect(rawState).not.toBeNull();
    expect(created).toHaveLength(1);
    expect(created[0]?.stateHash).toBe(hashMetaOAuthState(rawState ?? ''));
    expect(created[0]?.stateHash).not.toBe(rawState);
    expect(created[0]?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(invalidated).toEqual([`${BASE_BRAND.id}:user-1`]);
  });

  it('fails before creating a session when Meta is not configured', async () => {
    const sessions = stubMetaOAuthSessionsRepository({
      createSession: async () => {
        throw new Error('no debe crear sesión sin configuración');
      },
    });
    const client = stubMetaOAuthClient({
      buildAuthorizationUrl: () => {
        throw new MetaOAuthError('META_OAUTH_NOT_CONFIGURED', 'sin configurar', 503);
      },
    });
    const useCase = new StartMetaOAuthUseCase(stubBrandsRepository(), sessions, client);

    await expect(
      useCase.execute({ brandId: BASE_BRAND.id, userId: 'user-1' }),
    ).rejects.toMatchObject({ code: 'META_OAUTH_NOT_CONFIGURED', httpStatus: 503 });
  });

  it('throws BrandNotFoundError for an unknown brand', async () => {
    const useCase = new StartMetaOAuthUseCase(
      stubBrandsRepository({ findById: async () => null }),
      stubMetaOAuthSessionsRepository(),
      stubMetaOAuthClient(),
    );

    await expect(
      useCase.execute({ brandId: 'missing', userId: 'user-1' }),
    ).rejects.toBeInstanceOf(BrandNotFoundError);
  });
});
