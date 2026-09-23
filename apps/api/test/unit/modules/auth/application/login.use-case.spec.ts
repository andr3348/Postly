import { InvalidCredentialsError } from '../../../../../src/shared/errors.js';
import { LoginUseCase } from '../../../../../src/modules/auth/application/login.use-case.js';
import { BASE_USER, stubPasswordHasher, stubTokenIssuer, stubUsersRepository } from './test-stubs.js';

describe('LoginUseCase', () => {
  it('issues tokens on valid credentials', async () => {
    const users = stubUsersRepository({ findByEmail: async () => BASE_USER });
    const useCase = new LoginUseCase(users, stubPasswordHasher(), stubTokenIssuer());

    const output = await useCase.execute({ email: BASE_USER.email, password: 'secreto-123' });

    expect(output.user).toMatchObject({ id: BASE_USER.id, email: BASE_USER.email });
    expect(output.user).not.toHaveProperty('passwordHash');
    expect(output.tokens.refreshToken).toBe('refresh');
  });

  it('rejects an unknown email without revealing it', async () => {
    const useCase = new LoginUseCase(
      stubUsersRepository(),
      stubPasswordHasher(),
      stubTokenIssuer(),
    );

    await expect(
      useCase.execute({ email: 'nadie@postly.test', password: 'x' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rejects a wrong password with the same error', async () => {
    const users = stubUsersRepository({ findByEmail: async () => BASE_USER });
    const hasher = stubPasswordHasher({ verify: async () => false });
    const useCase = new LoginUseCase(users, hasher, stubTokenIssuer());

    await expect(
      useCase.execute({ email: BASE_USER.email, password: 'otra' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
