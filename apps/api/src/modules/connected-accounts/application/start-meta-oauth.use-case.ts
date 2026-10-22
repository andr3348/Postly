import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { BRANDS_REPOSITORY, type BrandsRepository } from '../../brand/domain/ports/brands.repository.js';
import { BrandNotFoundError } from '../../../shared/errors.js';
import {
  META_OAUTH_CLIENT,
  type MetaOAuthClient,
} from '../domain/ports/meta-oauth-client.port.js';
import {
  META_OAUTH_SESSIONS_REPOSITORY,
  type MetaOAuthSessionsRepository,
} from '../domain/ports/meta-oauth-sessions.repository.js';
import { hashMetaOAuthState } from './meta-oauth-state.js';

const SESSION_TTL_MS = 10 * 60 * 1000;

export interface StartMetaOAuthInput {
  readonly brandId: string;
  readonly userId: string;
}

export interface StartMetaOAuthResult {
  readonly authorizationUrl: string;
}

/**
 * Primer paso del OAuth: valida la marca, invalida sesiones previas del mismo
 * usuario/marca, guarda el hash del state (10 minutos) y devuelve la URL del
 * diálogo de Facebook Login for Business.
 */
@Injectable()
export class StartMetaOAuthUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY) private readonly brands: BrandsRepository,
    @Inject(META_OAUTH_SESSIONS_REPOSITORY)
    private readonly sessions: MetaOAuthSessionsRepository,
    @Inject(META_OAUTH_CLIENT) private readonly client: MetaOAuthClient,
  ) {}

  async execute(input: StartMetaOAuthInput): Promise<StartMetaOAuthResult> {
    const brand = await this.brands.findById(input.brandId);
    if (brand === null) {
      throw new BrandNotFoundError(input.brandId);
    }

    // Falla temprano si falta configuración, antes de crear una sesión huérfana.
    const state = randomBytes(32).toString('base64url');
    const authorizationUrl = this.client.buildAuthorizationUrl(state);

    const now = new Date();
    await this.sessions.deleteExpired(now);
    await this.sessions.invalidateActiveSessions(input.brandId, input.userId);
    await this.sessions.createSession({
      brandId: input.brandId,
      userId: input.userId,
      stateHash: hashMetaOAuthState(state),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    });

    return { authorizationUrl };
  }
}
