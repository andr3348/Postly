import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type {
  CreateMetaOAuthSessionInput,
  MetaOAuthSessionsRepository,
} from '../domain/ports/meta-oauth-sessions.repository.js';
import type {
  MetaOAuthSession,
  MetaOAuthSessionStatus,
  MetaPageAsset,
} from '../domain/meta-oauth.entity.js';
import { decrypt, encrypt } from '../../../shared/encryption.js';

/**
 * Persistencia de sesiones OAuth de Meta.
 * El payload con Page tokens se cifra aquí (AES-256-GCM, misma clave que las
 * credenciales) y nunca sale en claro de la capa de infraestructura.
 */
@Injectable()
export class PrismaMetaOAuthSessionsRepository implements MetaOAuthSessionsRepository {
  private readonly encryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    const key = configService.get<string>('ENCRYPTION_KEY');
    if (key === undefined || key === '') {
      throw new Error(
        '[connected-accounts] Missing ENCRYPTION_KEY. Define it in the api environment (64 hex chars).',
      );
    }
    this.encryptionKey = key;
  }

  async createSession(input: CreateMetaOAuthSessionInput): Promise<MetaOAuthSession> {
    const row = await this.prisma.client.metaOAuthSession.create({
      data: {
        brandId: input.brandId,
        userId: input.userId,
        stateHash: input.stateHash,
        expiresAt: input.expiresAt,
      },
    });
    return toDomainSession(row, null);
  }

  async findByStateHash(stateHash: string): Promise<MetaOAuthSession | null> {
    const row = await this.prisma.client.metaOAuthSession.findUnique({
      where: { stateHash },
    });
    return row === null ? null : toDomainSession(row, null);
  }

  async getSession(id: string): Promise<MetaOAuthSession | null> {
    const row = await this.prisma.client.metaOAuthSession.findUnique({ where: { id } });
    return row === null ? null : toDomainSession(row, this.decryptPages(row.encryptedPayload));
  }

  async consumeState(id: string, now: Date): Promise<boolean> {
    // Update a prueba de carrera: solo el primer callback que llegue con el
    // state válido y vigente lo consume.
    const consumed = await this.prisma.client.metaOAuthSession.updateMany({
      where: {
        id,
        status: 'PENDING',
        stateConsumedAt: null,
        expiresAt: { gt: now },
      },
      data: { stateConsumedAt: now },
    });
    return consumed.count > 0;
  }

  async markReady(id: string, pages: readonly MetaPageAsset[]): Promise<void> {
    await this.prisma.client.metaOAuthSession.update({
      where: { id },
      data: {
        status: 'READY',
        encryptedPayload: encrypt(JSON.stringify(pages), this.encryptionKey),
      },
    });
  }

  async markFailed(id: string, code: string, message: string): Promise<void> {
    await this.prisma.client.metaOAuthSession.update({
      where: { id },
      data: {
        status: 'FAILED',
        encryptedPayload: null,
        errorCode: code,
        errorMessage: message,
      },
    });
  }

  async completeSession(id: string): Promise<void> {
    await this.prisma.client.metaOAuthSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        // El payload tiene Page tokens: se borra en cuanto se persisten.
        encryptedPayload: null,
      },
    });
  }

  async invalidateActiveSessions(brandId: string, userId: string): Promise<void> {
    await this.prisma.client.metaOAuthSession.deleteMany({
      where: {
        brandId,
        userId,
        status: { in: ['PENDING', 'READY', 'FAILED'] },
      },
    });
  }

  async deleteExpired(now: Date): Promise<void> {
    await this.prisma.client.metaOAuthSession.deleteMany({
      where: { expiresAt: { lt: now } },
    });
  }

  /** Un payload corrupto no rompe la UI: la sesión queda sin páginas. */
  private decryptPages(encryptedPayload: string | null): MetaPageAsset[] | null {
    if (encryptedPayload === null) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(decrypt(encryptedPayload, this.encryptionKey));
      return Array.isArray(parsed) ? (parsed as MetaPageAsset[]) : null;
    } catch {
      return null;
    }
  }
}

interface MetaOAuthSessionRow {
  readonly id: string;
  readonly brandId: string;
  readonly userId: string;
  readonly status: string;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
}

function toDomainSession(
  row: MetaOAuthSessionRow,
  pages: MetaPageAsset[] | null,
): MetaOAuthSession {
  return {
    id: row.id,
    brandId: row.brandId,
    userId: row.userId,
    status: toDomainStatus(row.status),
    pages,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

function toDomainStatus(value: string): MetaOAuthSessionStatus {
  if (
    value === 'PENDING' ||
    value === 'READY' ||
    value === 'FAILED' ||
    value === 'COMPLETED'
  ) {
    return value;
  }
  throw new Error(`[connected-accounts] Unknown Meta OAuth session status: ${value}`);
}
