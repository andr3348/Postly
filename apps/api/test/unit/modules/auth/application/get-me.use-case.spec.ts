import { InvalidCredentialsError } from '../../../../../src/shared/errors.js';
import { GetMeUseCase } from '../../../../../src/modules/auth/application/get-me.use-case.js';
import { BASE_USER, stubUsersRepository } from './test-stubs.js';

describe('GetMeUseCase', () => {
  it('returns the safe profile including the real name', async () => {
    const users = stubUsersRepository({ findById: async () => BASE_USER });

    const me = await new GetMeUseCase(users).execute(BASE_USER.id);

    expect(me).toMatchObject({
      id: BASE_USER.id,
      email: BASE_USER.email,
      name: BASE_USER.name,
    });
    expect(me).not.toHaveProperty('passwordHash');
  });

  it('rejects a token whose user no longer exists', async () => {
    const useCase = new GetMeUseCase(stubUsersRepository());

    await expect(useCase.execute('ghost')).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
