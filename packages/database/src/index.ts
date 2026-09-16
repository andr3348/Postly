/**
 * Public entry of the `@postly/database` package for NestJS
 * (`import { prisma } from '@postly/database'`).
 *
 * Owns the connection: PrismaPg adapter + singleton PrismaClient.
 * Consuming apps never repeat adapter boilerplate and never depend on
 * `pg` / `@prisma/adapter-pg` directly. Domain models (User, Post, …)
 * appear here automatically once defined in `prisma/schema.prisma` +
 * `prisma generate` — no hand-written query code lives in this package.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";

import { Prisma, PrismaClient } from "./generated/prisma/client.js";

// Load `packages/database/.env` regardless of the consumer's CWD
// (api runs from `apps/api`, not from here). Real environment variables
// always win — dotenv never overrides them — so deployed env and shell
// exports take precedence over the local file.
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: path.join(packageDir, ".env") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy `packages/database/.env.example` to `.env` " +
      "or export DATABASE_URL (see /compose.yaml for the local database).",
  );
}

// One client per process, reused across hot-reloads (Nest `start:dev`,
// `tsx watch`) so re-evaluated modules don't leak connection pools.
const globalForPrisma = globalThis as unknown as { __postlyPrisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = (globalForPrisma.__postlyPrisma ??= createPrismaClient());

export { Prisma, PrismaClient };
export type * from "./generated/prisma/models.js";
