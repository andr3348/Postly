import { RevokeAuthSessionUseCase } from '../../../../../src/modules/auth/application/revoke-auth-session.use-case.js';
import {
  BASE_USER,
  SESSION,
  stubAuthSessionsRepository,
} from './test-stubs.js';

describe('RevokeAuthSessionUseCase', () => {
  it('revokes a session owned by the user', async () => {
    const revoked: { sessionId: string; userId: string }[] = [];
    const sessions = stubAuthSessionsRepository({
      revokeById: async (sessionId, userId) => {
        revoked.push({ sessionId, userId });
        return true;
      },
    });

    const output = await new RevokeAuthSessionUseCase(sessions).execute({
      userId: BASE_USER.id,
      sessionId: 'session-2',
      currentSessionId: SESSION.id,
    });

    expect(revoked).toEqual([
      { sessionId: 'session-2', userId: BASE_USER.id },
    ]);
    expect(output.revokedCurrent).toBe(false);
  });

  it('reports when the revoked session is the current one', async () => {
    const useCase = new RevokeAuthSessionUseCase(
      stubAuthSessionsRepository(),
    );

    await expect(
      useCase.execute({
        userId: BASE_USER.id,
        sessionId: SESSION.id,
        currentSessionId: SESSION.id,
      }),
    ).resolves.toEqual({ revokedCurrent: true });
  });
});
