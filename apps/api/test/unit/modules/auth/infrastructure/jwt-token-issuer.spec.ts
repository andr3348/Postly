import { JwtService } from '@nestjs/jwt';
import type { AuthJwtOptions } from '../../../../../src/modules/auth/infrastructure/auth-jwt.options.js';
import { JwtTokenIssuer } from '../../../../../src/modules/auth/infrastructure/jwt-token-issuer.js';

const OPTIONS: AuthJwtOptions = {
  accessSecret: 'test-access-secret-32-chars-min!!',
  accessExpiresInSeconds: 900,
  refreshExpiresInSeconds: 604_800,
};

describe('JwtTokenIssuer', () => {
  const issuer = new JwtTokenIssuer(new JwtService({}), OPTIONS);
  const user = { id: 'user-1', email: 'a@postly.test', role: 'MARKETING' as const };

  it('issues an access token bound to a session that verifies back', async () => {
    const token = await issuer.issueAccessToken(user, 'session-1');

    await expect(issuer.verifyAccessToken(token)).resolves.toEqual({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: 'session-1',
    });
  });

  it('rejects a token signed with another secret', async () => {
    const foreign = new JwtTokenIssuer(new JwtService({}), {
      ...OPTIONS,
      accessSecret: 'another-secret-32-chars-minimum!!',
    });
    const token = await foreign.issueAccessToken(user, 'session-1');

    await expect(issuer.verifyAccessToken(token)).resolves.toBeNull();
  });

  it('returns null for garbage tokens', async () => {
    await expect(issuer.verifyAccessToken('not-a-token')).resolves.toBeNull();
  });
});
