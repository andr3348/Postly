import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

/**
 * Opciones del módulo auth.
 * `DATABASE_URL` sigue siendo propiedad exclusiva de `packages/database`;
 * estos secretos son variables propias del api (ver docs/backend.md).
 *
 * `JWT_REFRESH_EXPIRES_IN_SECONDS` conserva el nombre por compatibilidad,
 * pero ahora define el TTL del refresh opaco y de la sesión (no de un JWT).
 * Expiraciones en **segundos** (número): `jsonwebtoken` los acepta de forma
 * nativa, así el tipado es exacto de punta a punta.
 */
const authJwtOptionsSchema = z.object({
  accessSecret: z.string().min(1),
  accessExpiresInSeconds: z.coerce.number().int().positive().default(900),
  refreshExpiresInSeconds: z.coerce.number().int().positive().default(604_800),
});

export type AuthJwtOptions = z.infer<typeof authJwtOptionsSchema>;

export const AUTH_JWT_OPTIONS: unique symbol = Symbol('AuthJwtOptions');

/**
 * Factoría usada en `AuthModule`. `getOrThrow` falla rápido sin el secreto
 * del access JWT; el schema valida forma y defaults. Sin `dotenv` directo:
 * la carga del `.env` la hace `ConfigModule` (ver `AppModule`).
 */
export function resolveAuthJwtOptions(config: ConfigService): AuthJwtOptions {
  return authJwtOptionsSchema.parse({
    accessSecret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    accessExpiresInSeconds: config.get<string>('JWT_ACCESS_EXPIRES_IN_SECONDS'),
    refreshExpiresInSeconds: config.get<string>('JWT_REFRESH_EXPIRES_IN_SECONDS'),
  });
}
