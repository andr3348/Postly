import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { N8nApiKeyGuard } from '../../../../src/modules/dispatch/infrastructure/n8n-api-key.guard.js';

function contextWithApiKey(apiKey: string | undefined): ExecutionContext {
  const headers: Record<string, string> = {};
  if (apiKey !== undefined) {
    headers['x-api-key'] = apiKey;
  }
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

function configWith(key: string | undefined): ConfigService {
  return {
    get: (name: string) => (name === 'N8N_API_KEY' ? key : undefined),
  } as unknown as ConfigService;
}

describe('N8nApiKeyGuard', () => {
  it('allows a valid key', () => {
    const guard = new N8nApiKeyGuard(configWith('secret-key'));

    expect(guard.canActivate(contextWithApiKey('secret-key'))).toBe(true);
  });

  it('rejects a wrong key', () => {
    const guard = new N8nApiKeyGuard(configWith('secret-key'));

    expect(() => guard.canActivate(contextWithApiKey('other-key'))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a missing header', () => {
    const guard = new N8nApiKeyGuard(configWith('secret-key'));

    expect(() => guard.canActivate(contextWithApiKey(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('fails fast without configured key', () => {
    expect(() => new N8nApiKeyGuard(configWith(undefined))).toThrow(
      '[dispatch] Missing N8N_API_KEY',
    );
  });
});
