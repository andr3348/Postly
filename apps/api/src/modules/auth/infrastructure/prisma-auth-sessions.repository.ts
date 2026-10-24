import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { AuthSession } from '../domain/auth-session.entity.js';
import type {
  AuthSessionsRepository,
  CreateAuthSessionInput,
  RotateRefreshTokenInput,
  RotateRefreshTokenResult,
} from '../domain/ports/auth-sessions.repository.js';

/**
 * Ventana de gracia ante refresh concurrentes (varias pestañas). Un token
 * consumido hace muy poco se rechaza sin revocar la sesión; uno reutilizado
 * más tarde se considera robo y revoca toda la sesión.
 */
const REUSE_GRACE_MS = 15_000;

@Injectable()
export class PrismaAuthSessionsRepository implements AuthSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAuthSessionInput): Promise<AuthSession> {
    const row = await this.prisma.client.authSession.create({
      data: {
        userId: input.userId,
        persistent: input.persistent,
        userAgent: input.userAgent,
        ip: input.ip,
        expiresAt: input.sessionExpiresAt,
        lastUsedAt: input.now,
        refreshTokens: {
          create: {
            tokenHash: input.tokenHash,
            expiresAt: input.tokenExpiresAt,
          },
        },
      },
    });
    return toDomainSession(row);
  }

  async rotate(input: RotateRefreshTokenInput): Promise<RotateRefreshTokenResult> {
    const current = await this.prisma.client.refreshToken.findUnique({
      where: { tokenHash: input.currentTokenHash },
      include: { session: true },
    });
    if (current === null) {
      return { status: 'INVALID' };
    }

    if (current.usedAt !== null) {
      return this.handleConsumedToken(
        current.sessionId,
        current.usedAt,
        input.now,
      );
    }
    if (
      current.expiresAt.getTime() <= input.now.getTime() ||
      current.session.revokedAt !== null ||
      current.session.expiresAt.getTime() <= input.now.getTime()
    ) {
      return { status: 'INVALID' };
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      // Update condicional: solo el primer refresh gana la carrera.
      const consumed = await tx.refreshToken.updateMany({
        where: { id: current.id, usedAt: null },
        data: { usedAt: input.now },
      });
      if (consumed.count === 0) {
        return { status: 'RACE' as const, sessionId: current.sessionId };
      }

      const created = await tx.refreshToken.create({
        data: {
          sessionId: current.sessionId,
          tokenHash: input.nextTokenHash,
          expiresAt: input.nextTokenExpiresAt,
        },
      });
      await tx.refreshToken.update({
        where: { id: current.id },
        data: { replacedByTokenId: created.id },
      });
      const session = await tx.authSession.update({
        where: { id: current.sessionId },
        data: {
          lastUsedAt: input.now,
          expiresAt: input.nextTokenExpiresAt,
        },
      });
      return { status: 'ROTATED' as const, session: toDomainSession(session) };
    });

    if (result.status === 'RACE') {
      return this.handleConsumedToken(result.sessionId, input.now, input.now);
    }
    return result;
  }

  async isActive(
    sessionId: string,
    userId: string,
    now: Date,
  ): Promise<boolean> {
    const session = await this.prisma.client.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true },
    });
    return session !== null;
  }

  async listActiveByUser(userId: string, now: Date): Promise<AuthSession[]> {
    const rows = await this.prisma.client.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { lastUsedAt: 'desc' },
    });
    return rows.map(toDomainSession);
  }

  async revokeById(
    sessionId: string,
    userId: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.prisma.client.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: now },
    });
    return result.count > 0;
  }

  async revokeByRefreshTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<boolean> {
    const token = await this.prisma.client.refreshToken.findUnique({
      where: { tokenHash },
      select: { sessionId: true },
    });
    if (token === null) {
      return false;
    }
    const result = await this.prisma.client.authSession.updateMany({
      where: { id: token.sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
    return result.count > 0;
  }

  async revokeOthers(
    userId: string,
    currentSessionId: string,
    now: Date,
  ): Promise<number> {
    const result = await this.prisma.client.authSession.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
    return result.count;
  }

  async deleteExpiredForUser(userId: string, now: Date): Promise<void> {
    await this.prisma.client.authSession.deleteMany({
      where: { userId, expiresAt: { lt: now } },
    });
  }

  private async handleConsumedToken(
    sessionId: string,
    usedAt: Date,
    now: Date,
  ): Promise<RotateRefreshTokenResult> {
    if (now.getTime() - usedAt.getTime() <= REUSE_GRACE_MS) {
      // Pestañas/peticiones concurrentes: se rechaza este intento sin
      // tumbar la sesión que el otro refresh acaba de renovar.
      return { status: 'INVALID' };
    }
    await this.prisma.client.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
    return { status: 'REUSED' };
  }
}

interface AuthSessionRow {
  readonly id: string;
  readonly userId: string;
  readonly persistent: boolean;
  readonly userAgent: string | null;
  readonly ip: string | null;
  readonly expiresAt: Date;
  readonly lastUsedAt: Date;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toDomainSession(row: AuthSessionRow): AuthSession {
  return {
    id: row.id,
    userId: row.userId,
    persistent: row.persistent,
    userAgent: row.userAgent,
    ip: row.ip,
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
