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

export class ForbiddenError extends Error {
  constructor(reason = 'Forbidden') {
    super(reason);
    this.name = 'ForbiddenError';
  }
}

export class PublicationNotFoundError extends Error {
  constructor(id: string) {
    super(`Publication with id ${id} not found`);
    this.name = 'PublicationNotFoundError';
  }
}

export class InvalidPublicationTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition publication from ${from} to ${to}`);
    this.name = 'InvalidPublicationTransitionError';
  }
}

export class BrandNotFoundError extends Error {
  constructor(id: string) {
    super(`Brand with id ${id} not found`);
    this.name = 'BrandNotFoundError';
  }
}
