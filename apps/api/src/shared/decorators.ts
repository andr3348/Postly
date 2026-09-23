import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca una ruta o controller como pública (el guard global la omite). */
export const Public = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(IS_PUBLIC_KEY, true);

/** Forma de `request.user` que fija el guard de autenticación. */
export interface AuthenticatedUser {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
}

interface RequestWithUser {
  readonly user?: AuthenticatedUser;
}

/** Extrae el usuario autenticado. Falla explícito si el guard no corrió. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user === undefined) {
      throw new Error('[auth] CurrentUser used without auth guard');
    }
    return request.user;
  },
);
