/**
 * Public library entry for the Turborepo.
 *
 * In Prisma v8 there is no `PrismaClient` class and no `prisma generate`.
 * The `db` object below (a `PostgresClient<Contract>`) IS the client.
 * NestJS apps should import from `database` (this file, built to
 * `dist/client.mjs`) and wrap it in an `@Injectable()` PrismaService —
 * see `apps/api/src/prisma.service.ts`.
 *
 * Query with the namespace-qualified ORM surface:
 * `db.orm.public.User.select(...).limit(...).all()`
 */
export { connectDatabase, db } from "./prisma/db.ts";
export { listUsers, type StarterUser } from "./prisma/users.ts";
export type { Contract } from "./prisma/contract.d.ts";

/** Convenience alias: the type of the shared v8 client. */
import type { db as _db } from "./prisma/db.ts";
export type DatabaseClient = typeof _db;
