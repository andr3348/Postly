import type {
  AuthResult,
  AuthSession,
} from '../../../../../src/modules/auth/domain/auth-session.entity.js';
import type {
  AuthSessionsRepository,
  RotateRefreshTokenResult,
} from '../../../../../src/modules/auth/domain/ports/auth-sessions.repository.js';
import type { PasswordHasher } from '../../../../../src/modules/auth/domain/ports/password-hasher.port.js';
import type {
  GeneratedRefreshToken,
  RefreshTokenService,
} from '../../../../../src/modules/auth/domain/ports/refresh-token.service.js';
import type { SessionIssuer } from '../../../../../src/modules/auth/domain/ports/session-issuer.port.js';
import type {
  AuthTokens,
  TokenIssuer,
} from '../../../../../src/modules/auth/domain/ports/token-issuer.port.js';
import type { UsersRepository } from '../../../../../src/modules/auth/domain/ports/users.repository.js';
import {
  toSafeUser,
  type User,
} from '../../../../../src/modules/auth/domain/user.entity.js';

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

const SESSION: AuthSession = {
  id: 'session-1',
  userId: BASE_USER.id,
  persistent: false,
  userAgent: 'vitest',
  ip: '127.0.0.1',
  expiresAt: new Date('2026-01-08T00:00:00Z'),
  lastUsedAt: new Date('2026-01-01T00:00:00Z'),
  revokedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const AUTH_RESULT: AuthResult = {
  user: toSafeUser(BASE_USER),
  tokens: TOKENS,
  session: { id: SESSION.id, persistent: SESSION.persistent },
};

const GENERATED_REFRESH: GeneratedRefreshToken = {
  token: 'next-refresh',
  hash: 'hashed:next-refresh',
  expiresAt: new Date('2026-01-08T00:00:00Z'),
};

export function stubUsersRepository(
  overrides: Partial<UsersRepository> = {},
): UsersRepository {
  return {
    findByEmail: async () => null,
    findById: async () => null,
    create: async (data) => ({ ...BASE_USER, ...data }),
    ...overrides,
  };
}

export function stubPasswordHasher(
  overrides: Partial<PasswordHasher> = {},
): PasswordHasher {
  return {
    hash: async (plain) => `hashed:${plain}`,
    verify: async () => true,
    ...overrides,
  };
}

export function stubTokenIssuer(
  overrides: Partial<TokenIssuer> = {},
): TokenIssuer {
  return {
    issueAccessToken: async () => 'access',
    verifyAccessToken: async () => null,
    ...overrides,
  };
}

export function stubSessionIssuer(
  overrides: Partial<SessionIssuer> = {},
): SessionIssuer {
  return {
    issue: async () => AUTH_RESULT,
    ...overrides,
  };
}

export function stubRefreshTokenService(
  overrides: Partial<RefreshTokenService> = {},
): RefreshTokenService {
  return {
    issue: () => GENERATED_REFRESH,
    hash: (token) => `hashed:${token}`,
    ...overrides,
  };
}

export function stubAuthSessionsRepository(
  overrides: Partial<AuthSessionsRepository> = {},
): AuthSessionsRepository {
  return {
    create: async () => SESSION,
    rotate: async (): Promise<RotateRefreshTokenResult> => ({
      status: 'ROTATED',
      session: SESSION,
    }),
    isActive: async () => true,
    listActiveByUser: async () => [SESSION],
    revokeById: async () => true,
    revokeByRefreshTokenHash: async () => true,
    revokeOthers: async () => 0,
    deleteExpiredForUser: async () => undefined,
    ...overrides,
  };
}

export { AUTH_RESULT, BASE_USER, GENERATED_REFRESH, SESSION, TOKENS };
