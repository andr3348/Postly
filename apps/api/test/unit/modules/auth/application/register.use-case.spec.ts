import { EmailAlreadyTakenError } from '../../../../../src/shared/errors.js';
import { RegisterUseCase } from '../../../../../src/modules/auth/application/register.use-case.js';
import { BASE_USER, stubPasswordHasher, stubTokenIssuer, stubUsersRepository } from './test-stubs.js';

describe('RegisterUseCase', () => {
  it('creates the user with a hashed password and issues tokens', async () => {
    const created: { email?: string; passwordHash?: string }[] = [];
    const users = stubUsersRepository({
      create: async (data) => {
        created.push(data);
        return { ...BASE_USER, ...data };
      },
    });
    const useCase = new RegisterUseCase(users, stubPasswordHasher(), stubTokenIssuer());

    const output = await useCase.execute({
      email: 'nuevo@postly.test',
      name: 'Nuevo',
      password: 'secreto-123',
    });

    expect(created).toHaveLength(1);
    expect(created[0]?.passwordHash).not.toBe('secreto-123');
    expect(output.user).toMatchObject({ email: 'nuevo@postly.test', name: 'Nuevo' });
    expect(output.user).not.toHaveProperty('passwordHash');
    expect(output.tokens.accessToken).toBe('access');
  });

  it('rejects an already registered email', async () => {
    const users = stubUsersRepository({ findByEmail: async () => BASE_USER });
    const useCase = new RegisterUseCase(users, stubPasswordHasher(), stubTokenIssuer());

    await expect(
      useCase.execute({ email: BASE_USER.email, name: 'X', password: 'secreto-123' }),
    ).rejects.toBeInstanceOf(EmailAlreadyTakenError);
  });
});
