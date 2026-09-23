import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { User, UserRole } from '../domain/user.entity.js';
import type {
  CreateUserData,
  UsersRepository,
} from '../domain/ports/users.repository.js';

/**
 * Adaptador Prisma de `UsersRepository`.
 * Único lugar del módulo que conoce al cliente generado:
 * mapea el enum de Prisma a la unión del dominio en el borde.
 */
@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.client.user.findUnique({ where: { email } });
    return row === null ? null : toDomainUser(row);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.client.user.findUnique({ where: { id } });
    return row === null ? null : toDomainUser(row);
  }

  async create(data: CreateUserData): Promise<User> {
    const row = await this.prisma.client.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        role: data.role ?? 'MARKETING',
      },
    });
    return toDomainUser(row);
  }
}

interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly role: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toDomainUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    role: toDomainRole(row.role),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDomainRole(role: string): UserRole {
  if (role === 'ADMIN' || role === 'MARKETING') {
    return role;
  }
  throw new Error(`[auth] Unknown role in database: ${role}`);
}
