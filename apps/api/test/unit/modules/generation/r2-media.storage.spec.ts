import { ConfigService } from '@nestjs/config';
import { R2MediaStorage } from '../../../../src/modules/generation/infrastructure/r2-media.storage.js';

function config(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function fullSettings(): Record<string, string> {
  return {
    R2_ACCOUNT_ID: 'acc-1',
    R2_ACCESS_KEY_ID: 'key-1',
    R2_SECRET_ACCESS_KEY: 'secret-1',
    R2_BUCKET: 'postly',
    R2_PUBLIC_BASE_URL: 'https://cdn.test/',
  };
}

const upload = {
  sourceUrl: 'https://fal.test/img.png',
  contentType: 'image/jpeg',
  key: 'publications/x.png',
};

describe('R2MediaStorage', () => {
  it('exige los R2_* completos y no llama a la red', async () => {
    const fetchMock = vi.fn();
    const send = vi.fn();
    const storage = new R2MediaStorage(config({ R2_BUCKET: 'postly' }), {
      fetchFn: fetchMock as unknown as typeof fetch,
      createClient: () => ({ send }),
    });

    await expect(storage.uploadFromUrl(upload)).rejects.toMatchObject({
      code: 'R2_NOT_CONFIGURED',
      provider: 'R2',
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('descarga la media, la sube al bucket y devuelve la URL pública', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'image/png' },
      }),
    );
    const send = vi.fn().mockResolvedValue({});
    const storage = new R2MediaStorage(config(fullSettings()), {
      fetchFn: fetchMock as unknown as typeof fetch,
      createClient: () => ({ send }),
    });

    const url = await storage.uploadFromUrl(upload);

    expect(url).toBe('https://cdn.test/publications/x.png');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'postly',
          Key: 'publications/x.png',
          ContentType: 'image/png',
        }),
      }),
    );
  });

  it('marca MEDIA_DOWNLOAD_FAILED si la descarga falla', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'));
    const send = vi.fn();
    const storage = new R2MediaStorage(config(fullSettings()), {
      fetchFn: fetchMock as unknown as typeof fetch,
      createClient: () => ({ send }),
    });

    await expect(storage.uploadFromUrl(upload)).rejects.toMatchObject({
      code: 'MEDIA_DOWNLOAD_FAILED',
      provider: 'FAL',
      retryable: true,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('marca MEDIA_DOWNLOAD_FAILED si la descarga responde HTTP no exitoso', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('gone', { status: 404 }));
    const storage = new R2MediaStorage(config(fullSettings()), {
      fetchFn: fetchMock as unknown as typeof fetch,
      createClient: () => ({ send: vi.fn() }),
    });

    await expect(storage.uploadFromUrl(upload)).rejects.toMatchObject({
      code: 'MEDIA_DOWNLOAD_FAILED',
      provider: 'FAL',
      retryable: true,
    });
  });

  it('marca R2_UPLOAD_FAILED si el bucket rechaza la subida', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1]), {
        headers: { 'Content-Type': 'image/png' },
      }),
    );
    const send = vi.fn().mockRejectedValue(new Error('access denied'));
    const storage = new R2MediaStorage(config(fullSettings()), {
      fetchFn: fetchMock as unknown as typeof fetch,
      createClient: () => ({ send }),
    });

    await expect(storage.uploadFromUrl(upload)).rejects.toMatchObject({
      code: 'R2_UPLOAD_FAILED',
      provider: 'R2',
      retryable: true,
    });
  });
});
