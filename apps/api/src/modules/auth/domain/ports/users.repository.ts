import type { User, UserRole } from '../user.entity.js';

/** Datos mínimos para crear un usuario (el hash ya viene calculado). */
export interface CreateUserData {
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly role?: UserRole;
}

/**
 * Puerto de persistencia de usuarios.
 * El adaptador vive en `infrastructure/` (hoy: Prisma).
 */
export interface UsersRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
}

export const USERS_REPOSITORY: unique symbol = Symbol('UsersRepository');
