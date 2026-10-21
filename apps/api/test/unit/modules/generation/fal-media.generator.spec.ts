import { ConfigService } from '@nestjs/config';
import { FalMediaGenerator } from '../../../../src/modules/generation/infrastructure/fal-media.generator.js';

function config(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const noSleep = async (): Promise<void> => {};

const IMAGE_MODEL = 'fal-ai/flux/schnell';
const VIDEO_MODEL = 'fal-ai/kling-video/v1.6/standard/text-to-video';
const IMAGE_QUEUE = `https://queue.fal.run/${IMAGE_MODEL}`;
const IMAGE_STATUS = `${IMAGE_QUEUE}/requests/req-1/status`;
const IMAGE_RESULT = `${IMAGE_QUEUE}/requests/req-1`;

function buildGenerator(
  fetchMock: ReturnType<typeof vi.fn>,
  overrides: Record<string, string | undefined> = {},
): FalMediaGenerator {
  return new FalMediaGenerator(
    config({
      FAL_KEY: 'test-key',
      FAL_POLL_INTERVAL_MS: '1',
      FAL_TIMEOUT_MS: '5000',
      ...overrides,
    }),
    { fetchFn: fetchMock as unknown as typeof fetch, sleepFn: noSleep },
  );
}

describe('FalMediaGenerator', () => {
  it('exige FAL_KEY y no llama a la red', async () => {
    const fetchMock = vi.fn();
    const generator = buildGenerator(fetchMock, { FAL_KEY: undefined });

    await expect(
      generator.generate({
        prompt: 'oficina',
        mediaType: 'IMAGE',
        aspectRatio: '1:1',
      }),
    ).rejects.toMatchObject({
      code: 'FAL_NOT_CONFIGURED',
      provider: 'FAL',
      retryable: false,
      httpStatus: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('encola, espera el estado y devuelve la imagen de fal', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          request_id: 'req-1',
          status_url: IMAGE_STATUS,
          response_url: IMAGE_RESULT,
        }),
      )
      .mockResolvedValueOnce(json({ status: 'IN_PROGRESS' }))
      .mockResolvedValueOnce(json({ status: 'COMPLETED' }))
      .mockResolvedValueOnce(
        json({
          images: [
            { url: 'https://fal.test/img.jpg', content_type: 'image/jpeg' },
          ],
        }),
      );

    const generator = buildGenerator(fetchMock);
    const media = await generator.generate({
      prompt: 'una oficina',
      mediaType: 'IMAGE',
      aspectRatio: '1:1',
    });

    expect(media).toEqual({
      url: 'https://fal.test/img.jpg',
      model: IMAGE_MODEL,
      contentType: 'image/jpeg',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const [submitUrl, submitInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(submitUrl).toBe(IMAGE_QUEUE);
    expect(submitInit.headers).toMatchObject({
      Authorization: 'Key test-key',
    });
    expect(JSON.parse(String(submitInit.body))).toEqual({
      prompt: 'una oficina',
      image_size: 'square_hd',
    });
  });

  it('usa el modelo de video y la relación de aspecto 9:16', async () => {
    const videoQueue = `https://queue.fal.run/${VIDEO_MODEL}`;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          request_id: 'req-2',
          status_url: `${videoQueue}/requests/req-2/status`,
          response_url: `${videoQueue}/requests/req-2`,
        }),
      )
      .mockResolvedValueOnce(json({ status: 'COMPLETED' }))
      .mockResolvedValueOnce(
        json({
          video: {
            url: 'https://fal.test/video.mp4',
            content_type: 'video/mp4',
          },
        }),
      );

    const generator = buildGenerator(fetchMock);
    const media = await generator.generate({
      prompt: 'reel de lanzamiento',
      mediaType: 'VIDEO',
      aspectRatio: '9:16',
    });

    expect(media).toEqual({
      url: 'https://fal.test/video.mp4',
      model: VIDEO_MODEL,
      contentType: 'video/mp4',
    });

    const [submitUrl, submitInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(submitUrl).toBe(videoQueue);
    expect(JSON.parse(String(submitInit.body))).toEqual({
      prompt: 'reel de lanzamiento',
      aspect_ratio: '9:16',
      duration: '5',
    });
  });

  it('mapea 401 a FAL_AUTH_FAILED y 429 a FAL_QUOTA_EXCEEDED', async () => {
    const unauthorized = buildGenerator(
      vi.fn().mockResolvedValueOnce(json({ detail: 'invalid key' }, 401)),
    );
    await expect(
      unauthorized.generate({
        prompt: 'p',
        mediaType: 'IMAGE',
        aspectRatio: '1:1',
      }),
    ).rejects.toMatchObject({
      code: 'FAL_AUTH_FAILED',
      provider: 'FAL',
      retryable: false,
    });

    const quota = buildGenerator(
      vi.fn().mockResolvedValueOnce(json({ detail: 'slow down' }, 429)),
    );
    await expect(
      quota.generate({
        prompt: 'p',
        mediaType: 'IMAGE',
        aspectRatio: '1:1',
      }),
    ).rejects.toMatchObject({
      code: 'FAL_QUOTA_EXCEEDED',
      provider: 'FAL',
      retryable: true,
      httpStatus: 429,
    });
  });

  it('rechaza el job cuando fal lo marca FAILED', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          request_id: 'req-1',
          status_url: IMAGE_STATUS,
          response_url: IMAGE_RESULT,
        }),
      )
      .mockResolvedValueOnce(json({ status: 'FAILED' }));

    const generator = buildGenerator(fetchMock);
    await expect(
      generator.generate({
        prompt: 'p',
        mediaType: 'IMAGE',
        aspectRatio: '1:1',
      }),
    ).rejects.toMatchObject({
      code: 'FAL_REJECTED',
      provider: 'FAL',
      retryable: false,
    });
  });

  it('agota el tiempo total de espera entre polls', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          request_id: 'req-1',
          status_url: IMAGE_STATUS,
          response_url: IMAGE_RESULT,
        }),
      )
      .mockImplementation(async () => json({ status: 'IN_QUEUE' }));

    const generator = buildGenerator(fetchMock, {
      FAL_POLL_INTERVAL_MS: '5',
      FAL_TIMEOUT_MS: '20',
    });
    await expect(
      generator.generate({
        prompt: 'p',
        mediaType: 'IMAGE',
        aspectRatio: '1:1',
      }),
    ).rejects.toMatchObject({
      code: 'FAL_TIMEOUT',
      provider: 'FAL',
      retryable: true,
      httpStatus: 504,
    });
  });

  it('marca FAL_UNREACHABLE cuando la red falla', async () => {
    const generator = buildGenerator(
      vi.fn().mockRejectedValue(new Error('boom')),
    );

    await expect(
      generator.generate({
        prompt: 'p',
        mediaType: 'IMAGE',
        aspectRatio: '1:1',
      }),
    ).rejects.toMatchObject({
      code: 'FAL_UNREACHABLE',
      provider: 'FAL',
      retryable: true,
    });
  });

  it('marca FAL_INVALID_RESPONSE cuando el resultado no trae media', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          request_id: 'req-1',
          status_url: IMAGE_STATUS,
          response_url: IMAGE_RESULT,
        }),
      )
      .mockResolvedValueOnce(json({ status: 'COMPLETED' }))
      .mockResolvedValueOnce(json({}));

    const generator = buildGenerator(fetchMock);
    await expect(
      generator.generate({
        prompt: 'p',
        mediaType: 'IMAGE',
        aspectRatio: '1:1',
      }),
    ).rejects.toMatchObject({
      code: 'FAL_INVALID_RESPONSE',
      provider: 'FAL',
      retryable: true,
      model: IMAGE_MODEL,
    });
  });
});
