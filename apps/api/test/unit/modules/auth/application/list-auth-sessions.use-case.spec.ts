import { ListAuthSessionsUseCase } from '../../../../../src/modules/auth/application/list-auth-sessions.use-case.js';
import {
  BASE_USER,
  SESSION,
  stubAuthSessionsRepository,
} from './test-stubs.js';

describe('ListAuthSessionsUseCase', () => {
  it('lists active sessions and flags the current one', async () => {
    const other = { ...SESSION, id: 'session-2', lastUsedAt: new Date('2025-12-31T00:00:00Z') };
    const sessions = stubAuthSessionsRepository({
      listActiveByUser: async () => [SESSION, other],
    });

    const output = await new ListAuthSessionsUseCase(sessions).execute({
      userId: BASE_USER.id,
      currentSessionId: SESSION.id,
    });

    expect(output).toHaveLength(2);
    expect(output[0]).toMatchObject({ id: SESSION.id, current: true });
    expect(output[1]).toMatchObject({ id: 'session-2', current: false });
    expect(output[0]).not.toHaveProperty('userId');
  });
});
