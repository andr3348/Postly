import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DispatchNotifier } from '../domain/ports/dispatch-notifier.port.js';

const TIMEOUT_MS = 5000;

/**
 * Despierta a n8n con un POST sin body. El secreto viaja en `x-webhook-secret`
 * y debe coincidir con la credencial Header Auth del nodo Webhook.
 * n8n responde de inmediato (Respond Immediately); el trabajo real lo hace su
 * workflow al reclamar la publicación.
 */
@Injectable()
export class N8nDispatchWebhookNotifier implements DispatchNotifier {
  private readonly url: string;
  private readonly secret: string;

  constructor(configService: ConfigService) {
    this.url = requireConfig(configService, 'N8N_DISPATCH_WEBHOOK_URL');
    this.secret = requireConfig(configService, 'INTERNAL_WEBHOOK_SECRET');
  }

  async notify(): Promise<void> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'x-webhook-secret': this.secret },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`n8n webhook responded ${response.status}`);
    }
  }
}

function requireConfig(configService: ConfigService, key: string): string {
  const value = configService.get<string>(key);
  if (value === undefined || value === '') {
    throw new Error(`[publish-now] Missing ${key}. Define it in the api environment (see docs).`);
  }
  return value;
}
