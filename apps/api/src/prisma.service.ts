import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { connectDatabase, db, listUsers, type DatabaseClient, type StarterUser } from 'database';

/**
 * Prisma v8 has no `PrismaClient` class. `db` (a `PostgresClient<Contract>`
 * from `packages/database`) IS the client — access models via
 * `this.prisma.db.orm.public.User...`.
 *
 * This service is a thin injectable wrapper so NestJS DI can share the
 * singleton across controllers/services. Query helpers (e.g. `listUsers`)
 * live in `packages/database` and are re-exposed here.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly db: DatabaseClient = db;

  async onModuleInit(): Promise<void> {
    await connectDatabase();
  }

  async onModuleDestroy(): Promise<void> {
    await db.close();
  }

  listUsers(limit = 10): Promise<StarterUser[]> {
    return listUsers(limit);
  }
}
