import { ConfigService } from '@nestjs/config';
import { GeminiTextGenerator } from '../../../../src/modules/generation/infrastructure/gemini-text.generator.js';

function config(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const GENERATED_TEXT = JSON.stringify({
  variants: [
    {
      copy: 'Copy',
      hashtags: ['#Marketing'],
      cta: 'CTA',
      mediaPrompt: 'Media',
      altText: 'Alt',
    },
  ],
});

describe('GeminiTextGenerator', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('llama a Gemini con JSON estructurado y devuelve el modelo usado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        candidates: [{ content: { parts: [{ text: GENERATED_TEXT }] } }],
        usageMetadata: { totalTokenCount: 456 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const generator = new GeminiTextGenerator(
      config({
        GEMINI_API_KEY: 'test-key',
        GEMINI_TEXT_MODEL: 'gemini-3.8-flash',
        GEMINI_TEXT_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
      }),
    );

    const result = await generator.generate({
      systemPrompt: 'sistema',
      userPrompt: 'usuario',
      mode: 'COPY',
    });

    expect(result).toMatchObject({
      model: 'gemini-3.8-flash',
      tokensUsed: 456,
      text: GENERATED_TEXT,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('gemini-3.8-flash:generateContent');
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'test-key' });

    const body = JSON.parse(String(init.body)) as {
      generationConfig: {
        responseMimeType: string;
        thinkingConfig: { thinkingLevel: string };
      };
    };
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.thinkingConfig).toEqual({
      thinkingLevel: 'low',
    });
  });

  it('usa el modelo fallback cuando el principal devuelve 503', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ error: { code: 503, message: 'busy' } }, 503),
      )
      .mockResolvedValueOnce(
        response({
          candidates: [{ content: { parts: [{ text: GENERATED_TEXT }] } }],
          usageMetadata: { totalTokenCount: 99 },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const generator = new GeminiTextGenerator(
      config({
        GEMINI_API_KEY: 'test-key',
        GEMINI_TEXT_MODEL: 'gemini-3.8-flash',
        GEMINI_TEXT_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
      }),
    );

    const result = await generator.generate({
      systemPrompt: 'sistema',
      userPrompt: 'usuario',
      mode: 'COPY',
    });

    expect(result.model).toBe('gemini-3.5-flash-lite');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('usa el fallback cuando el principal devuelve una respuesta vacía', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ candidates: [] }))
      .mockResolvedValueOnce(
        response({
          candidates: [{ content: { parts: [{ text: GENERATED_TEXT }] } }],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const generator = new GeminiTextGenerator(
      config({
        GEMINI_API_KEY: 'test-key',
        GEMINI_TEXT_MODEL: 'gemini-3.8-flash',
        GEMINI_TEXT_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
      }),
    );

    const result = await generator.generate({
      systemPrompt: 'sistema',
      userPrompt: 'usuario',
      mode: 'COPY',
    });

    expect(result.model).toBe('gemini-3.5-flash-lite');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falla rápido si falta la API key', async () => {
    const generator = new GeminiTextGenerator(config({}));

    await expect(
      generator.generate({ systemPrompt: 's', userPrompt: 'u', mode: 'IDEAS' }),
    ).rejects.toMatchObject({
      code: 'GEMINI_NOT_CONFIGURED',
      retryable: false,
      model: null,
    });
  });

  it('clasifica la cuota agotada como reintentable', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response(
          { error: { code: 429, message: 'Quota exceeded' } },
          429,
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const generator = new GeminiTextGenerator(
      config({
        GEMINI_API_KEY: 'test-key',
        GEMINI_TEXT_MODEL: 'gemini-3.8-flash',
        GEMINI_TEXT_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
      }),
    );

    await expect(
      generator.generate({ systemPrompt: 's', userPrompt: 'u', mode: 'COPY' }),
    ).rejects.toMatchObject({
      code: 'GEMINI_QUOTA_EXCEEDED',
      retryable: true,
      httpStatus: 429,
      model: 'gemini-3.5-flash-lite',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clasifica la alta demanda como reintentable', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        response(
          {
            error: {
              code: 503,
              message: 'The model is overloaded. Please try again later.',
            },
          },
          503,
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const generator = new GeminiTextGenerator(
      config({
        GEMINI_API_KEY: 'test-key',
        GEMINI_TEXT_MODEL: 'gemini-3.8-flash',
        GEMINI_TEXT_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
      }),
    );

    await expect(
      generator.generate({ systemPrompt: 's', userPrompt: 'u', mode: 'COPY' }),
    ).rejects.toMatchObject({
      code: 'GEMINI_OVERLOADED',
      retryable: true,
      httpStatus: 503,
      model: 'gemini-3.5-flash-lite',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('no reintenta errores de autenticación', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response(
        { error: { code: 401, message: 'API key not valid' } },
        401,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const generator = new GeminiTextGenerator(
      config({
        GEMINI_API_KEY: 'test-key',
        GEMINI_TEXT_MODEL: 'gemini-3.8-flash',
        GEMINI_TEXT_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
      }),
    );

    await expect(
      generator.generate({ systemPrompt: 's', userPrompt: 'u', mode: 'COPY' }),
    ).rejects.toMatchObject({
      code: 'GEMINI_AUTH_FAILED',
      retryable: false,
      httpStatus: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clasifica el timeout como reintentable', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    vi.stubGlobal('fetch', fetchMock);

    const generator = new GeminiTextGenerator(
      config({
        GEMINI_API_KEY: 'test-key',
        GEMINI_TEXT_MODEL: 'gemini-3.8-flash',
        GEMINI_TEXT_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
      }),
    );

    await expect(
      generator.generate({ systemPrompt: 's', userPrompt: 'u', mode: 'COPY' }),
    ).rejects.toMatchObject({
      code: 'GEMINI_TIMEOUT',
      retryable: true,
      httpStatus: 504,
    });
  });

  it('rechaza una respuesta bloqueada por seguridad', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        promptFeedback: { blockReason: 'SAFETY' },
        candidates: [],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const generator = new GeminiTextGenerator(
      config({
        GEMINI_API_KEY: 'test-key',
        GEMINI_TEXT_MODEL: 'gemini-3.8-flash',
        GEMINI_TEXT_FALLBACK_MODEL: 'gemini-3.5-flash-lite',
      }),
    );

    await expect(
      generator.generate({ systemPrompt: 's', userPrompt: 'u', mode: 'COPY' }),
    ).rejects.toMatchObject({
      name: 'AiGenerationRejectedError',
      code: 'GEMINI_SAFETY_BLOCKED',
      retryable: false,
      model: 'gemini-3.8-flash',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
