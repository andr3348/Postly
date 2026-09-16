import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { prisma, type PrismaClient } from '@postly/database';

/**
 * NestJS wrapper around the shared singleton from `@postly/database`.
 * Owns lifecycle only ($connect on boot, $disconnect on shutdown) —
 * connection config (PrismaPg adapter, DATABASE_URL) lives in the
 * database package. Repositories use `this.prisma.client.user...`.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: PrismaClient = prisma;

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
