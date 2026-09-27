/**
 * Errores de dominio compartidos (vocabulario estándar del backend).
 * Los casos de uso los lanzan; `shared/filters.ts` los traduce a HTTP.
 * Nunca importar nada de `modules/` desde aquí.
 */
export class EmailAlreadyTakenError extends Error {
  constructor(email: string) {
    super(`Email already registered: ${email}`);
    this.name = 'EmailAlreadyTakenError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('Invalid or expired refresh token');
    this.name = 'InvalidRefreshTokenError';
  }
}
