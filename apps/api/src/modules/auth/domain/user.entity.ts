/**
 * Entidad de dominio `User`.
 *
 * Tipo puro: no importa nada de Prisma, Nest ni ninguna librería.
 * El rol se modela como unión local para no acoplar el dominio
 * al cliente generado (el adaptador mapea en el borde).
 */
export type UserRole = 'ADMIN' | 'MARKETING';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly role: UserRole;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Proyección segura: nunca exponer `passwordHash` fuera del dominio. */
export type SafeUser = Omit<User, 'passwordHash'>;

export function toSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}
