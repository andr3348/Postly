import { AuthSessionIssuer } from '../../../../../src/modules/auth/application/auth-session-issuer.js';
import type { CreateAuthSessionInput } from '../../../../../src/modules/auth/domain/ports/auth-sessions.repository.js';
import {
  BASE_USER,
  GENERATED_REFRESH,
  SESSION,
  stubAuthSessionsRepository,
  stubRefreshTokenService,
  stubTokenIssuer,
} from './test-stubs.js';

describe('AuthSessionIssuer', () => {
  it('persists the hashed refresh token and binds the access token to the session', async () => {
    const created: CreateAuthSessionInput[] = [];
    const issuedAccess: { userId: string; sessionId: string }[] = [];
    const sessions = stubAuthSessionsRepository({
      create: async (input) => {
        created.push(input);
        return { ...SESSION, persistent: input.persistent };
      },
    });
    const issuer = new AuthSessionIssuer(
      sessions,
      stubRefreshTokenService(),
      stubTokenIssuer({
        issueAccessToken: async (user, sessionId) => {
          issuedAccess.push({ userId: user.id, sessionId });
          return 'access';
        },
      }),
    );

    const output = await issuer.issue(BASE_USER, {
      persistent: true,
      userAgent: 'vitest',
      ip: '127.0.0.1',
    });

    expect(output.tokens.refreshToken).toBe(GENERATED_REFRESH.token);
    expect(output.tokens.accessToken).toBe('access');
    expect(output.session).toEqual({ id: SESSION.id, persistent: true });
    expect(created[0]).toMatchObject({
      userId: BASE_USER.id,
      persistent: true,
      tokenHash: GENERATED_REFRESH.hash,
      tokenExpiresAt: GENERATED_REFRESH.expiresAt,
      sessionExpiresAt: GENERATED_REFRESH.expiresAt,
    });
    expect(issuedAccess).toEqual([
      { userId: BASE_USER.id, sessionId: SESSION.id },
    ]);
  });
});
