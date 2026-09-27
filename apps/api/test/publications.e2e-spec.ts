import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/shared/prisma/prisma.service.js';
import { setupApp } from './../src/setup-app.js';

/**
 * Flujo human-in-the-loop: crear → enviar → aprobar (admin) → transiciones
 * inválidas rechazadas. Usa el jar de cookies del agent como un navegador.
 */
describe('Publications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: string;
  let brandId: string;
  let publicationId: string;

  beforeEach(async () => {
    email = `e2e-pub-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@postly.test`;
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

  it('create → submit → approve as admin, rejects bad transitions', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E Pub', password: 'secreto-123' })
      .expect(201);

    const brand = await agent
      .post('/api/brands')
      .send({ name: 'Marca E2E' })
      .expect(201);
    brandId = brand.body.brand.id as string;

    const created = await agent
      .post('/api/publications')
      .send({
        brandId,
        originalPrompt: 'Post e2e',
        copy: 'Copy e2e',
        mediaUrl: 'https://postly.test/e2e.jpg',
      })
      .expect(201);
    expect(created.body).toMatchObject({ status: 'DRAFT', brandId });
    publicationId = created.body.id as string;

    // Sin canales no se puede enviar: 400.
    await agent.post(`/api/publications/${publicationId}/submit`).expect(400);

    await agent
      .post(`/api/publications/${publicationId}/targets`)
      .send({ platform: 'LINKEDIN' })
      .expect(201);

    // Canal duplicado: 409.
    await agent
      .post(`/api/publications/${publicationId}/targets`)
      .send({ platform: 'LINKEDIN' })
      .expect(409);

    const targets = await agent.get(`/api/publications/${publicationId}/targets`).expect(200);
    expect(targets.body).toHaveLength(1);

    await agent.post(`/api/publications/${publicationId}/submit`).expect(200);

    // Marketing no puede aprobar: 403.
    await agent
      .post(`/api/publications/${publicationId}/approve`)
      .send({ scheduledAt: '2026-10-01T09:00:00.000Z' })
      .expect(403);

    // Promover a ADMIN directo en BD (el registro siempre crea MARKETING)
    // + re-login: el rol viaja en el JWT, la cookie vieja sigue MARKETING.
    await prisma.client.user.update({ where: { email }, data: { role: 'ADMIN' } });
    await agent.post('/api/auth/login').send({ email, password: 'secreto-123' }).expect(200);

    const approved = await agent
      .post(`/api/publications/${publicationId}/approve`)
      .send({ scheduledAt: '2026-10-01T09:00:00.000Z' })
      .expect(200);
    expect(approved.body).toMatchObject({ status: 'SCHEDULED' });
    expect(approved.body.approvedAt).toEqual(expect.any(String));

    // Doble aprobación: 400 por transición inválida.
    await agent
      .post(`/api/publications/${publicationId}/approve`)
      .send({ scheduledAt: '2026-10-02T09:00:00.000Z' })
      .expect(400);

    // Publicación inexistente: 404.
    await agent.get('/api/publications/xxx-missing').expect(404);
  });
});
