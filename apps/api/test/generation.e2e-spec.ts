import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { LLM_TEXT_GENERATOR } from './../src/modules/generation/domain/ports/llm-text-generator.port.js';
import { AiGenerationUnavailableError } from './../src/shared/errors.js';
import { PrismaService } from './../src/shared/prisma/prisma.service.js';
import { setupApp } from './../src/setup-app.js';

/**
 * El endpoint de generación es stateless: con el puerto LLM reemplazado por un
 * stub, verifica auth, versionado, validación Zod y que no se cree ninguna
 * publicación.
 */
describe('Generation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: string;
  let brandId: string;
  const generate = vi.fn();

  beforeEach(async () => {
    email = `e2e-gen-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@postly.test`;
    generate.mockReset();
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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LLM_TEXT_GENERATOR)
      .useValue({ generate })
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
});
