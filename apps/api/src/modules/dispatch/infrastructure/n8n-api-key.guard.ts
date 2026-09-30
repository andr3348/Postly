import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * Auth máquina-a-máquina para n8n (API key estática por env).
 * Compara hashes SHA-256 con `timingSafeEqual`: los digests siempre miden
 * 32 bytes, así no hay fuga por longitud ni error de comparación.
 */
@Injectable()
export class N8nApiKeyGuard implements CanActivate {
  private readonly expectedHash: Buffer;

  constructor(configService: ConfigService) {
    const key = configService.get<string>('N8N_API_KEY');
    if (key === undefined || key === '') {
      throw new Error(
        '[dispatch] Missing N8N_API_KEY. Define it in the api environment (see docs).',
      );
    }
    this.expectedHash = sha256(key);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-api-key'];
    if (typeof provided !== 'string' || !timingSafeEqual(this.expectedHash, sha256(provided))) {
      throw new UnauthorizedException('Invalid n8n API key');
    }
    return true;
  }
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}
