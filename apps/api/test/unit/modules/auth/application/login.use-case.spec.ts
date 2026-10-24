import { InvalidCredentialsError } from '../../../../../src/shared/errors.js';
import { LoginUseCase } from '../../../../../src/modules/auth/application/login.use-case.js';
import type { SessionContext } from '../../../../../src/modules/auth/domain/ports/session-issuer.port.js';
import {
  AUTH_RESULT,
  BASE_USER,
  stubPasswordHasher,
  stubSessionIssuer,
  stubUsersRepository,
} from './test-stubs.js';

const CONTEXT = {
  rememberMe: false,
  userAgent: 'vitest',
  ip: '127.0.0.1',
} as const;

describe('LoginUseCase', () => {
  it('creates a session on valid credentials', async () => {
    const users = stubUsersRepository({ findByEmail: async () => BASE_USER });
    const useCase = new LoginUseCase(
      users,
      stubPasswordHasher(),
      stubSessionIssuer(),
    );

    const output = await useCase.execute({
      email: BASE_USER.email,
      password: 'secreto-123',
      ...CONTEXT,
    });

    expect(output.user).toMatchObject({
      id: BASE_USER.id,
      email: BASE_USER.email,
    });
    expect(output.user).not.toHaveProperty('passwordHash');
    expect(output.tokens.refreshToken).toBe('refresh');
  });

  it('passes rememberMe and request metadata to the session issuer', async () => {
    let context: SessionContext | undefined;
    const users = stubUsersRepository({ findByEmail: async () => BASE_USER });
    const sessions = stubSessionIssuer({
      issue: async (_user, input) => {
        context = input;
        return {
          ...AUTH_RESULT,
          session: { ...AUTH_RESULT.session, persistent: true },
        };
      },
    });
    const useCase = new LoginUseCase(users, stubPasswordHasher(), sessions);

    await useCase.execute({
      email: BASE_USER.email,
      password: 'secreto-123',
      ...CONTEXT,
      rememberMe: true,
    });

    expect(context).toEqual({
      persistent: true,
      userAgent: 'vitest',
      ip: '127.0.0.1',
    });
  });

  it('rejects an unknown email without revealing it', async () => {
    const useCase = new LoginUseCase(
      stubUsersRepository(),
      stubPasswordHasher(),
      stubSessionIssuer(),
    );

    await expect(
      useCase.execute({ email: 'nadie@postly.test', password: 'x', ...CONTEXT }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rejects a wrong password with the same error', async () => {
    const users = stubUsersRepository({ findByEmail: async () => BASE_USER });
    const hasher = stubPasswordHasher({ verify: async () => false });
    const useCase = new LoginUseCase(users, hasher, stubSessionIssuer());

    await expect(
      useCase.execute({ email: BASE_USER.email, password: 'otra', ...CONTEXT }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
