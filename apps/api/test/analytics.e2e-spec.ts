import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/shared/prisma/prisma.service.js';
import { setupApp } from './../src/setup-app.js';

/**
 * Agregados de solo lectura: solo cuenta el último snapshot por destino
 * y jamás divide por cero.
 */
describe('Analytics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: string;
  let brandId: string;
  let publicationId: string;

  beforeEach(async () => {
    email = `e2e-an-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@postly.test`;
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

  it('aggregates latest snapshots and guards division by zero', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E Analytics', password: 'secreto-123' })
      .expect(201);

    const brand = await agent.post('/api/brands').send({ name: 'Marca Analytics' }).expect(201);
    brandId = brand.body.brand.id as string;

    const created = await agent
      .post('/api/publications')
      .send({
        brandId,
        originalPrompt: 'Post analytics',
        copy: 'Copy analytics',
        mediaUrl: 'https://postly.test/an.jpg',
      })
      .expect(201);
    publicationId = created.body.id as string;

    await agent
      .post(`/api/publications/${publicationId}/targets`)
      .send({ platform: 'LINKEDIN' })
      .expect(201);
    await prisma.client.publicationTarget.updateMany({
      where: { publicationId },
      data: { status: 'SUCCESS' },
    });

    // Dos snapshots: solo el último cuenta (200, no 300).
    await agent
      .post(`/api/publications/${publicationId}/targets/LINKEDIN/metrics`)
      .send({ impressions: 100, likes: 5 })
      .expect(201);
    await agent
      .post(`/api/publications/${publicationId}/targets/LINKEDIN/metrics`)
      .send({ impressions: 200, likes: 20 })
      .expect(201);

    const summary = await agent
      .get(`/api/analytics/summary?brandId=${brandId}`)
      .expect(200);
    expect(summary.body).toMatchObject({
      totalPublications: 1,
      totalImpressions: 200,
      engagementRate: 10,
    });
    expect(summary.body.byPlatform).toHaveLength(1);

    await request(app.getHttpServer()).get('/api/analytics/summary').expect(401);
  });
});
