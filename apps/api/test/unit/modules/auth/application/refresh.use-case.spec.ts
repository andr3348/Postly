import { InvalidRefreshTokenError } from '../../../../../src/shared/errors.js';
import { RefreshUseCase } from '../../../../../src/modules/auth/application/refresh.use-case.js';
import { BASE_USER, stubTokenIssuer, stubUsersRepository } from './test-stubs.js';

describe('RefreshUseCase', () => {
  function arrange(issuerValid: boolean, userExists: boolean): RefreshUseCase {
    const issuer = stubTokenIssuer({
      verifyRefreshToken: async () => (issuerValid ? { userId: BASE_USER.id } : null),
    });
    const users = stubUsersRepository({
      findById: async () => (userExists ? BASE_USER : null),
    });
    return new RefreshUseCase(users, issuer);
  }

  it('rotates the token pair for a valid refresh token', async () => {
    const output = await arrange(true, true).execute({ refreshToken: 'valid' });

    expect(output.user).toMatchObject({ id: BASE_USER.id });
    expect(output.tokens.accessToken).toBe('access');
  });

  it('rejects an invalid refresh token', async () => {
    await expect(arrange(false, true).execute({ refreshToken: 'bad' })).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('rejects a refresh token whose user no longer exists', async () => {
    await expect(arrange(true, false).execute({ refreshToken: 'orphan' })).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });
});
