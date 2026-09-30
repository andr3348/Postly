import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/shared/prisma/prisma.service.js';
import { setupApp } from './../src/setup-app.js';

/**
 * Simula el worker n8n: reclama con x-api-key, publica (simulado) y reporta.
 * Sin API key → 401 incluso en rutas @Public (el guard JWT se omite,
 * pero el de servicio no).
 */
describe('Dispatch (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: string;
  let brandId: string;
  let publicationId: string;
  const apiKey = process.env['N8N_API_KEY'] ?? '';

  beforeEach(async () => {
    email = `e2e-n8n-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@postly.test`;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    if (publicationId !== undefined) {
      await prisma.client.publication.deleteMany({ where: { id: publicationId } });
    }
    if (brandId !== undefined) {
      await prisma.client.brand.deleteMany({ where: { id: brandId } });
    }
    await prisma.client.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('claim → report SUCCESS with metrics → PUBLISHED', async () => {
    const agent = request.agent(app.getHttpServer());
    const n8n = (method: 'post' | 'get', url: string) =>
      request(app.getHttpServer())
        [method](url)
        .set('x-api-key', apiKey);

    await agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E N8N', password: 'secreto-123' })
      .expect(201);

    const brand = await agent.post('/api/brands').send({ name: 'Marca N8N' }).expect(201);
    brandId = brand.body.brand.id as string;

    await agent
      .post(`/api/brands/${brandId}/accounts`)
      .send({
        platform: 'LINKEDIN',
        accountName: 'marcaoficial',
        externalAccountId: 'urn:li:org:9',
        accessToken: 'live-token-e2e',
      })
      .expect(201);

    const created = await agent
      .post('/api/publications')
      .send({
        brandId,
        originalPrompt: 'Post n8n',
        copy: 'Copy n8n',
        mediaUrl: 'https://postly.test/n8n.jpg',
      })
      .expect(201);
    publicationId = created.body.id as string;

    await agent.post(`/api/publications/${publicationId}/targets`).send({ platform: 'LINKEDIN' }).expect(201);
    await agent.post(`/api/publications/${publicationId}/submit`).expect(200);

    await prisma.client.user.update({ where: { email }, data: { role: 'ADMIN' } });
    await agent.post('/api/auth/login').send({ email, password: 'secreto-123' }).expect(200);
    // Vencida a propósito: el claim solo toma scheduledAt pasado.
    await agent
      .post(`/api/publications/${publicationId}/approve`)
      .send({ scheduledAt: '2020-01-01T09:00:00.000Z' })
      .expect(200);

    // Sin API key: 401 (aunque la ruta sea @Public para el guard JWT).
    await request(app.getHttpServer()).post('/api/dispatch/claim').expect(401);

    const claim = await n8n('post', '/api/dispatch/claim').expect(200);
    expect(claim.body.publication).toMatchObject({ id: publicationId, status: 'PROCESSING' });
    expect(claim.body.targets).toHaveLength(1);
    expect(claim.body.targets[0].credentials.accessToken).toBe('live-token-e2e');

    // Nada más vencido: 204 sin cuerpo.
    const empty = await n8n('post', '/api/dispatch/claim').expect(204);
    expect(empty.body).toEqual({});

    const targetId = claim.body.targets[0].target.id as string;
    const reported = await n8n('post', `/api/dispatch/targets/${targetId}/report`)
      .send({
        status: 'SUCCESS',
        externalPostId: 'urn:li:share:e2e',
        metrics: { impressions: 500, likes: 20 },
      })
      .expect(200);
    expect(reported.body).toMatchObject({ terminal: true });
    expect(reported.body.publication).toMatchObject({ status: 'PUBLISHED' });

    const history = await agent
      .get(`/api/publications/${publicationId}/targets/LINKEDIN/metrics`)
      .expect(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0]).toMatchObject({ impressions: 500 });
  });
});
