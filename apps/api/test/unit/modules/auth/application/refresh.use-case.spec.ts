import { InvalidRefreshTokenError } from '../../../../../src/shared/errors.js';
import { RefreshUseCase } from '../../../../../src/modules/auth/application/refresh.use-case.js';
import type {
  RotateRefreshTokenInput,
  RotateRefreshTokenResult,
} from '../../../../../src/modules/auth/domain/ports/auth-sessions.repository.js';
import {
  BASE_USER,
  GENERATED_REFRESH,
  SESSION,
  stubAuthSessionsRepository,
  stubRefreshTokenService,
  stubTokenIssuer,
  stubUsersRepository,
} from './test-stubs.js';

describe('RefreshUseCase', () => {
  function arrange(
    rotation: RotateRefreshTokenResult,
    userExists = true,
  ): { useCase: RefreshUseCase; rotateInputs: RotateRefreshTokenInput[] } {
    const rotateInputs: RotateRefreshTokenInput[] = [];
    const sessions = stubAuthSessionsRepository({
      rotate: async (input) => {
        rotateInputs.push(input);
        return rotation;
      },
    });
    const users = stubUsersRepository({
      findById: async () => (userExists ? BASE_USER : null),
    });
    return {
      useCase: new RefreshUseCase(
        sessions,
        stubRefreshTokenService(),
        users,
        stubTokenIssuer(),
      ),
      rotateInputs,
    };
  }

  it('rotates the refresh token and issues a new access token', async () => {
    const { useCase, rotateInputs } = arrange({
      status: 'ROTATED',
      session: SESSION,
    });

    const output = await useCase.execute({ refreshToken: 'current' });

    expect(output.user).toMatchObject({ id: BASE_USER.id });
    expect(output.tokens.accessToken).toBe('access');
    expect(output.tokens.refreshToken).toBe(GENERATED_REFRESH.token);
    expect(output.session).toEqual({
      id: SESSION.id,
      persistent: SESSION.persistent,
    });
    expect(rotateInputs[0]).toMatchObject({
      currentTokenHash: 'hashed:current',
      nextTokenHash: GENERATED_REFRESH.hash,
      nextTokenExpiresAt: GENERATED_REFRESH.expiresAt,
    });
  });

  it('rejects an invalid or expired refresh token', async () => {
    const { useCase } = arrange({ status: 'INVALID' });

    await expect(
      useCase.execute({ refreshToken: 'bad' }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('rejects a reused refresh token (session already revoked)', async () => {
    const { useCase } = arrange({ status: 'REUSED' });

    await expect(
      useCase.execute({ refreshToken: 'reused' }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('rejects a refresh token whose user no longer exists', async () => {
    const { useCase } = arrange(
      { status: 'ROTATED', session: SESSION },
      false,
    );

    await expect(
      useCase.execute({ refreshToken: 'orphan' }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });
});
