import { Inject, Injectable } from '@nestjs/common';
import { BRANDS_REPOSITORY, type BrandsRepository } from '../../brand/domain/ports/brands.repository.js';
import { BrandNotFoundError, MetaOAuthError } from '../../../shared/errors.js';
import {
  CONNECTED_ACCOUNTS_REPOSITORY,
  type ConnectedAccountsRepository,
} from '../domain/ports/connected-accounts.repository.js';
import {
  META_OAUTH_CLIENT,
  type MetaOAuthClient,
} from '../domain/ports/meta-oauth-client.port.js';
import {
  META_OAUTH_SESSIONS_REPOSITORY,
  type MetaOAuthSessionsRepository,
} from '../domain/ports/meta-oauth-sessions.repository.js';
import type { ConnectedAccount } from '../domain/connected-account.entity.js';
import type { MetaInstagramAsset } from '../domain/meta-oauth.entity.js';
import { assertSessionOwnership } from './meta-oauth-session.js';

export interface CompleteMetaOAuthInput {
  readonly brandId: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly pageId: string;
}

export interface CompleteMetaOAuthResult {
  readonly account: ConnectedAccount;
  /** IG vinculado a la página elegida (aún no conectado): la UI guía el paso. */
  readonly instagram: MetaInstagramAsset | null;
}

/**
 * Último paso: el usuario elige una Page del payload temporal y se persiste
 * como cuenta FACEBOOK con `authType: META_OAUTH`.
 *
 * Reglas de consistencia (confirmadas):
 * - Si la marca ya tiene Instagram conectado y la página elegida no es su
 *   página (u ofrece otra cuenta), se bloquea hasta desvincular Instagram.
 * - Si es la misma página, reconectar sincroniza también el Page token de IG.
 * - Instagram no se crea aquí: se conecta con su propio botón.
 */
@Injectable()
export class CompleteMetaOAuthUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY) private readonly brands: BrandsRepository,
    @Inject(CONNECTED_ACCOUNTS_REPOSITORY)
    private readonly accounts: ConnectedAccountsRepository,
    @Inject(META_OAUTH_SESSIONS_REPOSITORY)
    private readonly sessions: MetaOAuthSessionsRepository,
    @Inject(META_OAUTH_CLIENT) private readonly client: MetaOAuthClient,
  ) {}

  async execute(input: CompleteMetaOAuthInput): Promise<CompleteMetaOAuthResult> {
    const brand = await this.brands.findById(input.brandId);
    if (brand === null) {
      throw new BrandNotFoundError(input.brandId);
    }

    const session = assertSessionOwnership(
      await this.sessions.getSession(input.sessionId),
      input.brandId,
      input.userId,
    );
    if (session.status !== 'READY') {
      throw new MetaOAuthError(
        'META_OAUTH_INVALID_STATE',
        session.errorMessage ?? 'La sesión de conexión no está lista. Vuelve a intentarlo.',
      );
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new MetaOAuthError(
        'META_OAUTH_EXPIRED',
        'La conexión con Meta expiró. Inténtalo de nuevo.',
      );
    }

    const page = (session.pages ?? []).find((entry) => entry.id === input.pageId);
    if (page === undefined) {
      throw new MetaOAuthError(
        'META_PAGE_NOT_FOUND',
        'La página elegida ya no está disponible. Vuelve a conectar Meta.',
      );
    }

    const instagramSync = await this.resolveInstagramSync(input.brandId, page);

    const tokenInfo = await this.client.debugPageToken(page.accessToken);
    if (!tokenInfo.isValid) {
      await this.sessions.markFailed(
        session.id,
        'META_TOKEN_EXPIRED',
        'Meta rechazó el token de la página. Vuelve a conectar.',
      );
      throw new MetaOAuthError(
        'META_TOKEN_EXPIRED',
        'Meta rechazó el token de la página. Vuelve a conectar.',
      );
    }

    const connection = await this.accounts.upsertMetaPage(input.brandId, {
      page: {
        externalAccountId: page.id,
        accountName: page.name,
        accessToken: page.accessToken,
        expiresAt: tokenInfo.expiresAt,
        scope: tokenInfo.scopes.length > 0 ? tokenInfo.scopes.join(',') : null,
      },
      instagram: instagramSync,
    });
    await this.sessions.completeSession(session.id);

    return { account: connection.account, instagram: page.instagram };
  }

  /**
   * Decide si hay que sincronizar el token de Instagram al guardar la Page.
   * Bloquea el cambio de página si Instagram ya está conectado a otra.
   */
  private async resolveInstagramSync(
    brandId: string,
    page: { readonly instagram: MetaInstagramAsset | null },
  ): Promise<{ externalAccountId: string; accountName: string } | null> {
    const existing = await this.accounts.findByBrandAndPlatform(brandId, 'INSTAGRAM');
    const active =
      existing !== null &&
      (existing.status === 'CONNECTED' || existing.status === 'EXPIRED');
    if (!active || existing === null) {
      return null;
    }

    if (page.instagram === null || page.instagram.id !== existing.externalAccountId) {
      throw new MetaOAuthError(
        'META_PAGE_MISMATCH',
        'Ya hay una cuenta de Instagram conectada a otra página. Desconéctala antes de cambiar la página de Facebook.',
        409,
      );
    }

    return {
      externalAccountId: page.instagram.id,
      accountName: page.instagram.username,
    };
  }
}
