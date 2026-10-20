import { ConfigService } from '@nestjs/config';
import { N8nDispatchWebhookNotifier } from '../../../../src/modules/publications/infrastructure/n8n-dispatch-webhook.notifier.js';

const URL = 'http://localhost:5678/webhook/publish-now';
const SECRET = 'webhook-secret';

function configService(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function stubFetch(response: { ok: boolean; status: number }) {
  const mock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('N8nDispatchWebhookNotifier', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the webhook with x-webhook-secret and no body', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200 });
    const notifier = new N8nDispatchWebhookNotifier(
      configService({
        N8N_DISPATCH_WEBHOOK_URL: URL,
        INTERNAL_WEBHOOK_SECRET: SECRET,
      }),
    );

    await notifier.notify();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'x-webhook-secret': SECRET });
    expect(init.body).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws when the webhook responds non-2xx', async () => {
    stubFetch({ ok: false, status: 502 });
    const notifier = new N8nDispatchWebhookNotifier(
      configService({
        N8N_DISPATCH_WEBHOOK_URL: URL,
        INTERNAL_WEBHOOK_SECRET: SECRET,
      }),
    );

    await expect(notifier.notify()).rejects.toThrow('n8n webhook responded 502');
  });

  it('fails fast when the URL is missing', () => {
    expect(
      () =>
        new N8nDispatchWebhookNotifier(
          configService({ INTERNAL_WEBHOOK_SECRET: SECRET }),
        ),
    ).toThrow('Missing N8N_DISPATCH_WEBHOOK_URL');
  });

  it('fails fast when the secret is missing', () => {
    expect(
      () =>
        new N8nDispatchWebhookNotifier(
          configService({ N8N_DISPATCH_WEBHOOK_URL: URL }),
        ),
    ).toThrow('Missing INTERNAL_WEBHOOK_SECRET');
  });
});
