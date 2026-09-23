import type { PasswordHasher } from '../../../../../src/modules/auth/domain/ports/password-hasher.port.js';
import type { AuthTokens, TokenIssuer } from '../../../../../src/modules/auth/domain/ports/token-issuer.port.js';
import type { UsersRepository } from '../../../../../src/modules/auth/domain/ports/users.repository.js';
import type { User } from '../../../../../src/modules/auth/domain/user.entity.js';

const BASE_USER: User = {
  id: 'user-1',
  email: 'marketing@postly.test',
  name: 'Marketing',
  passwordHash: 'hashed',
  role: 'MARKETING',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const TOKENS: AuthTokens = { accessToken: 'access', refreshToken: 'refresh' };

export function stubUsersRepository(overrides: Partial<UsersRepository> = {}): UsersRepository {
  return {
    findByEmail: async () => null,
    findById: async () => null,
    create: async (data) => ({ ...BASE_USER, ...data }),
    ...overrides,
  };
}

export function stubPasswordHasher(overrides: Partial<PasswordHasher> = {}): PasswordHasher {
  return {
    hash: async (plain) => `hashed:${plain}`,
    verify: async () => true,
    ...overrides,
  };
}

export function stubTokenIssuer(overrides: Partial<TokenIssuer> = {}): TokenIssuer {
  return {
    issuePair: async () => TOKENS,
    verifyAccessToken: async () => null,
    verifyRefreshToken: async () => null,
    ...overrides,
  };
}

export { BASE_USER, TOKENS };
