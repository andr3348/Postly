import { Inject, Injectable } from '@nestjs/common';
import { MetaOAuthError } from '../../../shared/errors.js';
import {
  META_OAUTH_CLIENT,
  type MetaOAuthClient,
} from '../domain/ports/meta-oauth-client.port.js';
import {
  META_OAUTH_SESSIONS_REPOSITORY,
  type MetaOAuthSessionsRepository,
} from '../domain/ports/meta-oauth-sessions.repository.js';
import type { MetaOAuthSession } from '../domain/meta-oauth.entity.js';
import { hashMetaOAuthState } from './meta-oauth-state.js';

const ACCOUNTS_PATH = '/dashboard/accounts';

export interface MetaOAuthCallbackInput {
  readonly code?: string;
  readonly state?: string;
  readonly error?: string;
  readonly errorDescription?: string;
}

export interface MetaOAuthCallbackResult {
  /** URL absoluta del dashboard; el controller responde 302. */
  readonly redirectUrl: string;
}

/**
 * Callback público de Meta (sin JWT: el navegador vuelve de facebook.com).
 * Nunca lanza al usuario: traduce cualquier fallo a un redirect al dashboard
 * con una sesión (que la UI consulta) o un `meta_error` genérico.
 */
@Injectable()
export class HandleMetaOAuthCallbackUseCase {
  constructor(
    @Inject(META_OAUTH_SESSIONS_REPOSITORY)
    private readonly sessions: MetaOAuthSessionsRepository,
    @Inject(META_OAUTH_CLIENT) private readonly client: MetaOAuthClient,
  ) {}

  async execute(input: MetaOAuthCallbackInput): Promise<MetaOAuthCallbackResult> {
    const state = input.state;
    if (state === undefined || state === '') {
      return this.genericErrorRedirect('invalid_state');
    }

    const session = await this.sessions.findByStateHash(hashMetaOAuthState(state));
    if (session === null || session.status !== 'PENDING') {
      return this.genericErrorRedirect('expired');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.sessions.markFailed(
        session.id,
        'META_OAUTH_EXPIRED',
        'La conexión con Meta expiró. Inténtalo de nuevo.',
      );
      return this.sessionRedirect(session);
    }

    // El usuario canceló en el diálogo de Meta (error=access_denied).
    if (input.error !== undefined && input.error !== '') {
      await this.sessions.markFailed(
        session.id,
        'META_OAUTH_DENIED',
        'Cancelaste la conexión con Meta. Puedes intentarlo de nuevo.',
      );
      return this.sessionRedirect(session);
    }

    const consumed = await this.sessions.consumeState(session.id, new Date());
    if (!consumed) {
      return this.genericErrorRedirect('expired');
    }

    if (input.code === undefined || input.code === '') {
      await this.sessions.markFailed(
        session.id,
        'META_OAUTH_EXCHANGE_FAILED',
        'Meta no devolvió el código de autorización. Inténtalo de nuevo.',
      );
      return this.sessionRedirect(session);
    }

    try {
      const userAccessToken = await this.client.exchangeCodeForLongLivedUserToken(
        input.code,
      );
      const pages = await this.client.listPages(userAccessToken);
      if (pages.length === 0) {
        await this.sessions.markFailed(
          session.id,
          'META_NO_PAGES',
          'La cuenta de Meta no administra ninguna página de Facebook. Crea o pide acceso a una página e inténtalo de nuevo.',
        );
        return this.sessionRedirect(session);
      }
      await this.sessions.markReady(session.id, pages);
      return this.sessionRedirect(session);
    } catch (error: unknown) {
      const metaError = error instanceof MetaOAuthError ? error : null;
      await this.sessions.markFailed(
        session.id,
        metaError?.code ?? 'META_GRAPH_ERROR',
        metaError?.message ?? 'No se pudo completar la conexión con Meta.',
      );
      return this.sessionRedirect(session);
    }
  }

  private sessionRedirect(session: MetaOAuthSession): MetaOAuthCallbackResult {
    const params = new URLSearchParams({
      meta_session: session.id,
      meta_brand: session.brandId,
    });
    return {
      redirectUrl: this.client.buildFrontendUrl(`${ACCOUNTS_PATH}?${params.toString()}`),
    };
  }

  private genericErrorRedirect(reason: 'invalid_state' | 'expired'): MetaOAuthCallbackResult {
    const params = new URLSearchParams({ meta_error: reason });
    return {
      redirectUrl: this.client.buildFrontendUrl(`${ACCOUNTS_PATH}?${params.toString()}`),
    };
  }
}
