import { LogoutUseCase } from '../../../../../src/modules/auth/application/logout.use-case.js';
import { stubAuthSessionsRepository } from './test-stubs.js';

describe('LogoutUseCase', () => {
  it('revokes the session identified by the refresh token hash', async () => {
    const revoked: string[] = [];
    const sessions = stubAuthSessionsRepository({
      revokeByRefreshTokenHash: async (hash) => {
        revoked.push(hash);
        return true;
      },
    });

    await new LogoutUseCase(sessions, {
      issue: () => {
        throw new Error('not used');
      },
      hash: (token) => `hashed:${token}`,
    }).execute({ refreshToken: 'refresh-value' });

    expect(revoked).toEqual(['hashed:refresh-value']);
  });

  it('is a no-op without a refresh token', async () => {
    let called = false;
    const sessions = stubAuthSessionsRepository({
      revokeByRefreshTokenHash: async () => {
        called = true;
        return false;
      },
    });

    await expect(
      new LogoutUseCase(sessions, {
        issue: () => {
          throw new Error('not used');
        },
        hash: (token) => token,
      }).execute({ refreshToken: null }),
    ).resolves.toBeUndefined();
    expect(called).toBe(false);
  });
});
