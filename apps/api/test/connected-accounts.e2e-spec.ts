import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/shared/prisma/prisma.service.js';
import { setupApp } from './../src/setup-app.js';

/**
 * Cuentas conectadas: vincular → listar (sin secretos) → desvincular.
 * Los tokens entran por el cuerpo pero jamás salen en el JSON.
 */
describe('ConnectedAccounts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: string;
  let brandId: string;

  const account = {
    platform: 'LINKEDIN',
    accountName: 'almaquintaoficial',
    externalAccountId: 'urn:li:org:1',
    accessToken: 'live-token-for-e2e-only',
  };

  beforeEach(async () => {
    email = `e2e-acc-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@postly.test`;
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
    if (brandId !== undefined) {
      // Las cuentas caen en cascada con la marca.
      await prisma.client.brand.deleteMany({ where: { id: brandId } });
    }
    await prisma.client.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('connect → list without secrets → disconnect → 404 on repeat', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E Acc', password: 'secreto-123' })
      .expect(201);

    const brand = await agent.post('/api/brands').send({ name: 'Marca E2E' }).expect(201);
    brandId = brand.body.brand.id as string;

    const connected = await agent
      .post(`/api/brands/${brandId}/accounts`)
      .send(account)
      .expect(201);
    expect(connected.body).toMatchObject({ platform: 'LINKEDIN', status: 'CONNECTED' });
    expect(connected.body).not.toHaveProperty('accessToken');
    expect(connected.body).not.toHaveProperty('refreshToken');

    const listed = await agent.get(`/api/brands/${brandId}/accounts`).expect(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).not.toHaveProperty('accessToken');

    await agent.delete(`/api/brands/${brandId}/accounts/LINKEDIN`).expect(204);

    // Desvincular dos veces: 404 la segunda.
    await agent.delete(`/api/brands/${brandId}/accounts/LINKEDIN`).expect(404);

    // Plataforma inválida: 400 por schema, no 500.
    await agent.delete(`/api/brands/${brandId}/accounts/MYSPACE`).expect(400);
  });
});
