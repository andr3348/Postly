import { Inject, Injectable } from '@nestjs/common';
import { BRANDS_REPOSITORY, type BrandsRepository } from '../../brand/domain/ports/brands.repository.js';
import { BrandNotFoundError, MetaOAuthError } from '../../../shared/errors.js';
import {
  META_OAUTH_SESSIONS_REPOSITORY,
  type MetaOAuthSessionsRepository,
} from '../domain/ports/meta-oauth-sessions.repository.js';
import type {
  MetaInstagramAsset,
  MetaOAuthSessionStatus,
} from '../domain/meta-oauth.entity.js';
import { assertSessionOwnership } from './meta-oauth-session.js';

export interface MetaOAuthSessionPageView {
  readonly id: string;
  readonly name: string;
  readonly instagram: MetaInstagramAsset | null;
}

export interface MetaOAuthSessionView {
  readonly id: string;
  readonly status: MetaOAuthSessionStatus;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly pages: readonly MetaOAuthSessionPageView[];
}

export interface GetMetaOAuthSessionInput {
  readonly brandId: string;
  readonly userId: string;
  readonly sessionId: string;
}

/**
 * Consulta de la sesión para el dashboard. Devuelve páginas sin Page tokens:
 * el token solo vive cifrado en la base y en memoria del backend.
 */
@Injectable()
export class GetMetaOAuthSessionUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY) private readonly brands: BrandsRepository,
    @Inject(META_OAUTH_SESSIONS_REPOSITORY)
    private readonly sessions: MetaOAuthSessionsRepository,
  ) {}

  async execute(input: GetMetaOAuthSessionInput): Promise<MetaOAuthSessionView> {
    const brand = await this.brands.findById(input.brandId);
    if (brand === null) {
      throw new BrandNotFoundError(input.brandId);
    }

    const session = assertSessionOwnership(
      await this.sessions.getSession(input.sessionId),
      input.brandId,
      input.userId,
    );

    if (session.status !== 'COMPLETED' && session.expiresAt.getTime() <= Date.now()) {
      throw new MetaOAuthError(
        'META_OAUTH_EXPIRED',
        'La conexión con Meta expiró. Inténtalo de nuevo.',
      );
    }

    return {
      id: session.id,
      status: session.status,
      errorCode: session.errorCode,
      errorMessage: session.errorMessage,
      pages: (session.pages ?? []).map((page) => ({
        id: page.id,
        name: page.name,
        instagram: page.instagram,
      })),
    };
  }
}
