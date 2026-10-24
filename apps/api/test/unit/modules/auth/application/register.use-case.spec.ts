import { EmailAlreadyTakenError } from '../../../../../src/shared/errors.js';
import { RegisterUseCase } from '../../../../../src/modules/auth/application/register.use-case.js';
import type { SessionContext } from '../../../../../src/modules/auth/domain/ports/session-issuer.port.js';
import {
  AUTH_RESULT,
  BASE_USER,
  stubPasswordHasher,
  stubSessionIssuer,
  stubUsersRepository,
} from './test-stubs.js';

const CONTEXT = { userAgent: 'vitest', ip: '127.0.0.1' } as const;

describe('RegisterUseCase', () => {
  it('creates the user with a hashed password and a non-persistent session', async () => {
    const created: { email?: string; passwordHash?: string }[] = [];
    let context: SessionContext | undefined;
    const users = stubUsersRepository({
      create: async (data) => {
        created.push(data);
        return { ...BASE_USER, ...data };
      },
    });
    const sessions = stubSessionIssuer({
      issue: async (_user, input) => {
        context = input;
        return {
          ...AUTH_RESULT,
          user: {
            ...AUTH_RESULT.user,
            email: 'nuevo@postly.test',
            name: 'Nuevo',
          },
          session: { ...AUTH_RESULT.session, persistent: false },
        };
      },
    });
    const useCase = new RegisterUseCase(users, stubPasswordHasher(), sessions);

    const output = await useCase.execute({
      email: 'nuevo@postly.test',
      name: 'Nuevo',
      password: 'secreto-123',
      ...CONTEXT,
    });

    expect(created).toHaveLength(1);
    expect(created[0]?.passwordHash).not.toBe('secreto-123');
    expect(output.user).toMatchObject({
      email: 'nuevo@postly.test',
      name: 'Nuevo',
    });
    expect(output.user).not.toHaveProperty('passwordHash');
    expect(output.tokens.accessToken).toBe('access');
    expect(context).toEqual({
      persistent: false,
      userAgent: 'vitest',
      ip: '127.0.0.1',
    });
  });

  it('rejects an already registered email', async () => {
    const users = stubUsersRepository({ findByEmail: async () => BASE_USER });
    const useCase = new RegisterUseCase(
      users,
      stubPasswordHasher(),
      stubSessionIssuer(),
    );

    await expect(
      useCase.execute({
        email: BASE_USER.email,
        name: 'X',
        password: 'secreto-123',
        ...CONTEXT,
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyTakenError);
  });
});
