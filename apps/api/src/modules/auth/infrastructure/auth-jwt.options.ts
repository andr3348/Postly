import type { JwtSignOptions } from '@nestjs/jwt';

/**
 * Opciones JWT del módulo auth, leídas del entorno del api.
 * `DATABASE_URL` sigue siendo propiedad exclusiva de `packages/database`;
 * estos secretos son las primeras variables propias del api.
 */
export interface AuthJwtOptions {
  readonly accessSecret: string;
  readonly refreshSecret: string;
  readonly accessExpiresIn: JwtSignOptions['expiresIn'];
  readonly refreshExpiresIn: JwtSignOptions['expiresIn'];
}

export const AUTH_JWT_OPTIONS: unique symbol = Symbol('AuthJwtOptions');

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `[auth] Missing required env var ${name}. ` +
        'Define it in the api environment (see README §7).',
    );
  }
  return value;
}

/** Factoría usada en `AuthModule`; falla rápido y con mensaje claro. */
export function resolveAuthJwtOptions(): AuthJwtOptions {
  return {
    accessSecret: requiredEnv('JWT_ACCESS_SECRET'),
    refreshSecret: requiredEnv('JWT_REFRESH_SECRET'),
    // `process.env` entrega `string`: cast explícito en el borde al tipo
    // que jsonwebtoken acepta (`'15m'`, `'7d'`, segundos...). Si el valor
    // fuese inválido, `sign` lo rechaza al primer uso, no en silencio.
    accessExpiresIn: (process.env['JWT_ACCESS_EXPIRES_IN'] ??
      '15m') as JwtSignOptions['expiresIn'],
    refreshExpiresIn: (process.env['JWT_REFRESH_EXPIRES_IN'] ??
      '7d') as JwtSignOptions['expiresIn'],
  };
}
