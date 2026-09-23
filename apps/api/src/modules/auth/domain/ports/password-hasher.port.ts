/**
 * Puerto de hashing de contraseñas.
 * El adaptador vive en `infrastructure/` (hoy: argon2id).
 */
export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, passwordHash: string): Promise<boolean>;
}

export const PASSWORD_HASHER: unique symbol = Symbol('PasswordHasher');
