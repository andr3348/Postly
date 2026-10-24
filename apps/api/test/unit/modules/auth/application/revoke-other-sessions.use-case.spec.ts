import { RevokeOtherSessionsUseCase } from '../../../../../src/modules/auth/application/revoke-other-sessions.use-case.js';
import {
  BASE_USER,
  SESSION,
  stubAuthSessionsRepository,
} from './test-stubs.js';

describe('RevokeOtherSessionsUseCase', () => {
  it('keeps the current session and revokes the rest', async () => {
    const calls: { userId: string; currentSessionId: string }[] = [];
    const sessions = stubAuthSessionsRepository({
      revokeOthers: async (userId, currentSessionId) => {
        calls.push({ userId, currentSessionId });
        return 3;
      },
    });

    const revoked = await new RevokeOtherSessionsUseCase(sessions).execute({
      userId: BASE_USER.id,
      currentSessionId: SESSION.id,
    });

    expect(revoked).toBe(3);
    expect(calls).toEqual([
      { userId: BASE_USER.id, currentSessionId: SESSION.id },
    ]);
  });
});
