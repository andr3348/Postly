import { Inject, Injectable } from '@nestjs/common';
import { InvalidCredentialsError } from '../../../shared/errors.js';
import { toSafeUser, type SafeUser } from '../domain/user.entity.js';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../domain/ports/users.repository.js';

/**
 * Perfil propio para el dashboard (nombre real incluido: el JWT solo
 * lleva id/email/rol y el frontend no debe inventar el nombre del email).
 */
@Injectable()
export class GetMeUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
  ) {}

  async execute(userId: string): Promise<SafeUser> {
    const user = await this.users.findById(userId);
    if (user === null) {
      // Token válido de un usuario ya eliminado.
      throw new InvalidCredentialsError();
    }
    return toSafeUser(user);
  }
}
