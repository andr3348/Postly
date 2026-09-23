import { JwtService } from '@nestjs/jwt';
import type { AuthJwtOptions } from '../../../../../src/modules/auth/infrastructure/auth-jwt.options.js';
import { JwtTokenIssuer } from '../../../../../src/modules/auth/infrastructure/jwt-token-issuer.js';

const OPTIONS: AuthJwtOptions = {
  accessSecret: 'test-access-secret-32-chars-min!!',
  refreshSecret: 'test-refresh-secret-32-chars-min!',
  accessExpiresIn: '15m',
  refreshExpiresIn: '7d',
};

describe('JwtTokenIssuer', () => {
  const issuer = new JwtTokenIssuer(new JwtService({}), OPTIONS);
  const user = { id: 'user-1', email: 'a@postly.test', role: 'MARKETING' as const };

  it('issues an access/refresh pair that verifies back', async () => {
    const tokens = await issuer.issuePair(user);

    await expect(issuer.verifyAccessToken(tokens.accessToken)).resolves.toMatchObject({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    await expect(issuer.verifyRefreshToken(tokens.refreshToken)).resolves.toEqual({
      userId: user.id,
    });
  });

  it('rejects an access token presented as a refresh token', async () => {
    const tokens = await issuer.issuePair(user);

    await expect(issuer.verifyRefreshToken(tokens.accessToken)).resolves.toBeNull();
  });

  it('returns null for garbage tokens', async () => {
    await expect(issuer.verifyAccessToken('not-a-token')).resolves.toBeNull();
    await expect(issuer.verifyRefreshToken('not-a-token')).resolves.toBeNull();
  });
});
