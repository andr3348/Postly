/**
 * Public entry of the `database` package for NestJS (`import ... from 'database'`).
 *
 * Re-exports the generated Prisma v7 client. Domain models (User, Post, …)
 * appear here automatically once defined in `prisma/schema.prisma` +
 * `prisma generate` — no hand-written query code lives in this package.
 */
export { Prisma, PrismaClient } from "./generated/prisma/client.js";
export type * from "./generated/prisma/models.js";
