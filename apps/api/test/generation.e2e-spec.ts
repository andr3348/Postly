import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { LLM_TEXT_GENERATOR } from './../src/modules/generation/domain/ports/llm-text-generator.port.js';
import { MEDIA_GENERATOR } from './../src/modules/generation/domain/ports/media-generator.port.js';
import { MEDIA_STORAGE } from './../src/modules/generation/domain/ports/media-storage.port.js';
import { AiGenerationUnavailableError } from './../src/shared/errors.js';
import { PrismaService } from './../src/shared/prisma/prisma.service.js';
import { setupApp } from './../src/setup-app.js';

/**
 * Generación con IA. `text` es stateless (auth, versionado, validación Zod y
 * cero publicaciones); `agent` orquesta texto → media → R2 → borrador, con
 * los tres puertos reemplazados por stubs para no llamar a la red.
 */
describe('Generation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: string;
  let brandId: string;
  const generate = vi.fn();
  const generateMedia = vi.fn();
  const uploadMedia = vi.fn();

  const AGENT_VARIANT = {
    title: 'Título del agente',
    copy: 'Copy del agente',
    hashtags: ['Marketing'],
    cta: 'CTA del agente',
    mediaPrompt: 'Video del agente',
    altText: 'Alt del agente',
  };

  const agentVariantsText = JSON.stringify({ variants: [AGENT_VARIANT] });

  beforeEach(async () => {
    email = `e2e-gen-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@postly.test`;
    generate.mockReset();
    generateMedia.mockReset();
    uploadMedia.mockReset();
    generate.mockResolvedValue({
      model: 'fake-model',
      tokensUsed: 10,
      text: JSON.stringify({
        ideas: [
          {
            title: 'Idea de prueba',
            angle: 'Ángulo',
            hook: 'Hook',
            whyItWorks: 'Funciona',
            suggestedFormat: 'FEED',
          },
        ],
      }),
    });
    generateMedia.mockResolvedValue({
      url: 'https://fal.test/media.jpg',
      model: 'stub-image',
      contentType: 'image/jpeg',
    });
    uploadMedia.mockResolvedValue('https://r2.test/publications/media.jpg');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LLM_TEXT_GENERATOR)
      .useValue({ generate })
      .overrideProvider(MEDIA_GENERATOR)
      .useValue({ generate: generateMedia })
      .overrideProvider(MEDIA_STORAGE)
      .useValue({ uploadFromUrl: uploadMedia })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    if (brandId !== undefined) {
      await prisma.client.brand.deleteMany({ where: { id: brandId } });
    }
    await prisma.client.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('genera ideas autenticado sin persistir publicaciones', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E Generation', password: 'secreto-123' })
      .expect(201);

    const brand = await agent.post('/api/brands').send({ name: 'Marca Generation' }).expect(201);
    brandId = brand.body.brand.id as string;

    const before = await prisma.client.publication.count({ where: { brandId } });

    const response = await agent
      .post('/api/v1/generations/text')
      .send({
        brandId,
        mode: 'IDEAS',
        prompt: 'Curso de marketing para pymes',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      model: 'fake-model',
      tokensUsed: 10,
    });
    expect(response.body.ideas).toHaveLength(1);
    expect(response.body.variants).toEqual([]);
    expect(generate).toHaveBeenCalledTimes(1);

    const after = await prisma.client.publication.count({ where: { brandId } });
    expect(after).toBe(before);
  });

  it('rechaza el modo IDEAS sin prompt y exige sesión', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E Generation', password: 'secreto-123' })
      .expect(201);

    const brand = await agent.post('/api/brands').send({ name: 'Marca Generation' }).expect(201);
    brandId = brand.body.brand.id as string;

    await agent
      .post('/api/v1/generations/text')
      .send({ brandId, mode: 'IDEAS' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/generations/text')
      .send({ brandId, mode: 'IDEAS', prompt: 'Brief' })
      .expect(401);
  });

  it('expone código y reintento cuando Gemini agota la cuota', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E Generation', password: 'secreto-123' })
      .expect(201);

    const brand = await agent
      .post('/api/brands')
      .send({ name: 'Marca Generation' })
      .expect(201);
    brandId = brand.body.brand.id as string;

    generate.mockRejectedValueOnce(
      new AiGenerationUnavailableError({
        code: 'GEMINI_QUOTA_EXCEEDED',
        message:
          'Gemini alcanzó su límite de uso o cuota. Espera unos minutos y vuelve a intentarlo.',
        retryable: true,
        httpStatus: 429,
        model: 'gemini-3.8-flash',
      }),
    );

    const response = await agent
      .post('/api/v1/generations/text')
      .send({ brandId, mode: 'IDEAS', prompt: 'Brief' })
      .expect(429);

    expect(response.body).toMatchObject({
      statusCode: 429,
      code: 'GEMINI_QUOTA_EXCEEDED',
      provider: 'GEMINI',
      model: 'gemini-3.8-flash',
      retryable: true,
    });
  });

  it('no ofrece reintento cuando la IA no está configurada', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E Generation', password: 'secreto-123' })
      .expect(201);

    const brand = await agent
      .post('/api/brands')
      .send({ name: 'Marca Generation' })
      .expect(201);
    brandId = brand.body.brand.id as string;

    generate.mockRejectedValueOnce(
      new AiGenerationUnavailableError({
        code: 'GEMINI_NOT_CONFIGURED',
        message:
          'El asistente de IA no está configurado. Avisa al administrador.',
        retryable: false,
      }),
    );

    const response = await agent
      .post('/api/v1/generations/text')
      .send({ brandId, mode: 'IDEAS', prompt: 'Brief' })
      .expect(503);

    expect(response.body).toMatchObject({
      statusCode: 503,
      code: 'GEMINI_NOT_CONFIGURED',
      retryable: false,
    });
    expect(response.body.model).toBeUndefined();
  });

  it('crea el borrador en modo agente y audita modelo de media y tokens', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E Generation', password: 'secreto-123' })
      .expect(201);

    const brand = await agent
      .post('/api/brands')
      .send({ name: 'Marca Generation' })
      .expect(201);
    brandId = brand.body.brand.id as string;

    generate.mockResolvedValueOnce({
      model: 'fake-model',
      tokensUsed: 10,
      text: agentVariantsText,
    });
    generateMedia.mockResolvedValueOnce({
      url: 'https://fal.test/video.mp4',
      model: 'stub-video',
      contentType: 'video/mp4',
    });
    uploadMedia.mockResolvedValueOnce(
      'https://r2.test/publications/video.mp4',
    );

    const response = await agent
      .post('/api/v1/generations/agent')
      .send({
        brandId,
        prompt: 'Reel del lanzamiento',
        platform: 'INSTAGRAM',
        format: 'REEL',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      status: 'DRAFT',
      brandId,
      title: AGENT_VARIANT.title,
      copy: 'Copy del agente\n\n#Marketing',
      mediaUrl: 'https://r2.test/publications/video.mp4',
      mediaType: 'VIDEO',
      modelText: 'fake-model',
      modelMedia: 'stub-video',
      tokensUsed: 10,
    });

    expect(generateMedia).toHaveBeenCalledWith({
      prompt: AGENT_VARIANT.mediaPrompt,
      mediaType: 'VIDEO',
      aspectRatio: '9:16',
    });
    expect(uploadMedia).toHaveBeenCalledWith({
      sourceUrl: 'https://fal.test/video.mp4',
      contentType: 'video/mp4',
      key: expect.stringMatching(/^publications\/[0-9a-f-]{36}\.mp4$/),
    });

    const stored = await prisma.client.publication.findUnique({
      where: { id: response.body.id as string },
      select: { status: true, modelMedia: true, tokensUsed: true },
    });
    expect(stored).toMatchObject({
      status: 'DRAFT',
      modelMedia: 'stub-video',
      tokensUsed: 10,
    });

    const targets = await agent
      .get(`/api/publications/${response.body.id as string}/targets`)
      .expect(200);
    expect(targets.body).toEqual([]);
  });

  it('expone error estructurado de fal y no crea borrador cuando falta la key', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E Generation', password: 'secreto-123' })
      .expect(201);

    const brand = await agent
      .post('/api/brands')
      .send({ name: 'Marca Generation' })
      .expect(201);
    brandId = brand.body.brand.id as string;

    generate.mockResolvedValueOnce({
      model: 'fake-model',
      tokensUsed: 10,
      text: agentVariantsText,
    });
    generateMedia.mockRejectedValueOnce(
      new AiGenerationUnavailableError({
        code: 'FAL_NOT_CONFIGURED',
        provider: 'FAL',
        message:
          'La generación de media no está configurada. Avisa al administrador.',
        retryable: false,
      }),
    );

    const response = await agent
      .post('/api/v1/generations/agent')
      .send({
        brandId,
        prompt: 'Post de feed',
        platform: 'FACEBOOK',
        format: 'FEED',
      })
      .expect(503);

    expect(response.body).toMatchObject({
      statusCode: 503,
      code: 'FAL_NOT_CONFIGURED',
      provider: 'FAL',
      retryable: false,
    });
    expect(uploadMedia).not.toHaveBeenCalled();

    const count = await prisma.client.publication.count({
      where: { brandId },
    });
    expect(count).toBe(0);
  });

  it('rechaza REEL fuera de Facebook e Instagram en modo agente', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E Generation', password: 'secreto-123' })
      .expect(201);

    const brand = await agent
      .post('/api/brands')
      .send({ name: 'Marca Generation' })
      .expect(201);
    brandId = brand.body.brand.id as string;

    await agent
      .post('/api/v1/generations/agent')
      .send({
        brandId,
        prompt: 'Reel para LinkedIn',
        platform: 'LINKEDIN',
        format: 'REEL',
      })
      .expect(400);

    expect(generate).not.toHaveBeenCalled();
    expect(generateMedia).not.toHaveBeenCalled();
  });
});
