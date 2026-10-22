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
import type { ConnectedAccount } from '../domain/connected-account.entity.js';

/**
 * Segundo paso de Meta: Instagram depende de Facebook. Usa el Page token ya
 * guardado para leer `instagram_business_account` de la página y, si existe,
 * persiste INSTAGRAM con el mismo token y `metaPageId`.
 *
 * No inicia un segundo OAuth ni acepta tokens del cliente.
 */
@Injectable()
export class ConnectInstagramFromFacebookUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY) private readonly brands: BrandsRepository,
    @Inject(CONNECTED_ACCOUNTS_REPOSITORY)
    private readonly accounts: ConnectedAccountsRepository,
    @Inject(META_OAUTH_CLIENT) private readonly client: MetaOAuthClient,
  ) {}

  async execute(brandId: string): Promise<ConnectedAccount> {
    const brand = await this.brands.findById(brandId);
    if (brand === null) {
      throw new BrandNotFoundError(brandId);
    }

    const facebook = await this.accounts.findByBrandAndPlatform(brandId, 'FACEBOOK');
    const pageId = facebook?.externalAccountId ?? null;
    const pageToken = facebook?.accessToken ?? null;
    if (
      facebook === null ||
      facebook.status === 'DISCONNECTED' ||
      pageId === null ||
      pageToken === null
    ) {
      throw new MetaOAuthError(
        'META_FACEBOOK_NOT_CONNECTED',
        'Conecta primero la página de Facebook: Instagram se vincula a través de Meta.',
        409,
      );
    }
    if (facebook.status === 'EXPIRED') {
      throw new MetaOAuthError(
        'META_TOKEN_EXPIRED',
        'La conexión de Facebook venció. Vuelve a conectar Facebook antes de vincular Instagram.',
      );
    }

    let instagram;
    try {
      instagram = await this.client.getPageInstagram(pageId, pageToken);
    } catch (error: unknown) {
      if (error instanceof MetaOAuthError && error.code === 'META_TOKEN_EXPIRED') {
        // El token compartido ya no sirve: ambas cuentas quedan vencidas para
        // que la UI pida reconectar (no se borran, se pueden renovar con OAuth).
        await this.accounts.markExpired(brandId, ['FACEBOOK', 'INSTAGRAM']);
        throw new MetaOAuthError(
          'META_TOKEN_EXPIRED',
          'La conexión de Meta venció. Vuelve a conectar Facebook.',
        );
      }
      throw error;
    }

    if (instagram === null) {
      throw new MetaOAuthError(
        'META_INSTAGRAM_NOT_LINKED',
        'La página no tiene una cuenta de Instagram profesional vinculada (o faltan permisos). Vincúlala desde Instagram o Meta Business Suite y vuelve a intentar.',
      );
    }

    const existing = await this.accounts.findByBrandAndPlatform(brandId, 'INSTAGRAM');
    if (
      existing !== null &&
      existing.status !== 'DISCONNECTED' &&
      existing.externalAccountId !== instagram.id
    ) {
      throw new MetaOAuthError(
        'META_PAGE_MISMATCH',
        'La marca ya tiene otra cuenta de Instagram conectada. Desvincúlala antes de conectar esta.',
        409,
      );
    }

    return this.accounts.upsertAccount(brandId, {
      platform: 'INSTAGRAM',
      accountName: instagram.username,
      externalAccountId: instagram.id,
      accessToken: pageToken,
      expiresAt: facebook.expiresAt ?? undefined,
      scope: facebook.scope ?? undefined,
      status: 'CONNECTED',
      authType: 'META_OAUTH',
      metaPageId: pageId,
    });
  }
}
