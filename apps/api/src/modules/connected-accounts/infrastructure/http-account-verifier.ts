import { Injectable } from '@nestjs/common';
import { InvalidAccountCredentialsError } from '../../../shared/errors.js';
import type {
  AccountVerifier,
  VerifiedAccountInfo,
  VerifyAccountInput,
} from '../domain/ports/account-verifier.port.js';

const GRAPH_VERSION = 'v25.0';
const TIMEOUT_MS = 8000;

/**
 * Verifica tokens contra las APIs oficiales (solo lectura, sin publicar).
 * - Meta (Facebook/Instagram): mismo Page access token, IDs distintos.
 *   FB usa el Page ID, IG usa el IG Professional ID vinculado a esa Page.
 * - LinkedIn: solo valida que el token sea válido (`/v2/userinfo`); el
 *   chequeo de pertenencia a la organización queda pendiente (requiere
 *   `r_organization_social`).
 * - TikTok: valida contra `/v2/user/info/`.
 */
@Injectable()
export class HttpAccountVerifier implements AccountVerifier {
  async verify(input: VerifyAccountInput): Promise<VerifiedAccountInfo> {
    switch (input.platform) {
      case 'FACEBOOK':
        return this.verifyMeta(input, 'name');
      case 'INSTAGRAM':
        return this.verifyMeta(input, 'username');
      case 'LINKEDIN':
        return this.verifyLinkedIn(input);
      case 'TIKTOK':
        return this.verifyTikTok(input);
    }
  }

  private async verifyMeta(
    input: VerifyAccountInput,
    nameField: 'name' | 'username',
  ): Promise<VerifiedAccountInfo> {
    const url =
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(input.externalAccountId)}` +
      `?fields=id,${nameField}&access_token=${encodeURIComponent(input.accessToken)}`;
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new InvalidAccountCredentialsError(input.platform, 'Provider unreachable or timed out');
    }
    if (!response.ok) {
      throw new InvalidAccountCredentialsError(input.platform, await readMetaError(response));
    }
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const displayName = typeof body?.[nameField] === 'string' ? (body[nameField] as string) : null;
    return { displayName };
  }

  private async verifyLinkedIn(input: VerifyAccountInput): Promise<VerifiedAccountInfo> {
    let response: Response;
    try {
      response = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${input.accessToken}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new InvalidAccountCredentialsError(input.platform, 'Provider unreachable or timed out');
    }
    if (!response.ok) {
      throw new InvalidAccountCredentialsError(input.platform, `HTTP ${response.status}`);
    }
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const displayName = typeof body?.['name'] === 'string' ? (body['name'] as string) : null;
    return { displayName };
  }

  private async verifyTikTok(input: VerifyAccountInput): Promise<VerifiedAccountInfo> {
    let response: Response;
    try {
      response = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name',
        {
          headers: { Authorization: `Bearer ${input.accessToken}` },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
    } catch {
      throw new InvalidAccountCredentialsError(input.platform, 'Provider unreachable or timed out');
    }
    const body = (await response.json().catch(() => null)) as {
      data?: { user?: { display_name?: unknown } };
      error?: { code?: unknown; message?: unknown };
    } | null;
    if (!response.ok || body?.error?.code !== 'ok') {
      const detail =
        typeof body?.error?.message === 'string' ? body.error.message : `HTTP ${response.status}`;
      throw new InvalidAccountCredentialsError(input.platform, detail);
    }
    const displayName =
      typeof body?.data?.user?.display_name === 'string'
        ? (body.data.user.display_name as string)
        : null;
    return { displayName };
  }
}

async function readMetaError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: unknown; code?: unknown };
  } | null;
  const message = body?.error?.message;
  return typeof message === 'string' && message !== '' ? message : `HTTP ${response.status}`;
}
