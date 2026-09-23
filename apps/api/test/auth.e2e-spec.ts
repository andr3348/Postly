import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/shared/prisma/prisma.service.js';
import { setupApp } from './../src/setup-app.js';

/**
 * Flujo por cookies HttpOnly: el agent conserva el jar entre requests,
 * igual que un navegador. Los tokens jamás aparecen en el JSON.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // Email fresco por test: independencia total aunque una corrida anterior
  // haya muerto antes del cleanup (el afterEach cubre el caso normal).
  let email: string;

  beforeEach(async () => {
    email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@postly.test`;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mismo prefijo y middlewares que `main.ts`: el e2e pega a lo real.
    app.setGlobalPrefix('api');
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.client.user.deleteMany({ where: { email: { in: [email, 'no-es-email'] } } });
    await app.close();
  });

  function setCookiesOf(response: { headers: Record<string, string | string[]> }): string[] {
    const raw = response.headers['set-cookie'];
    return Array.isArray(raw) ? raw : [];
  }

  function expectAuthCookies(response: { headers: Record<string, string | string[]> }): void {
    const cookies = setCookiesOf(response);
    const access = cookies.find((c) => c.startsWith('accessToken='));
    const refresh = cookies.find((c) => c.startsWith('refreshToken='));
    expect(access).toContain('HttpOnly');
    expect(refresh).toContain('HttpOnly');
  }

  it('register → login → refresh → me (solo cookies, sin tokens en JSON)', async () => {
    const agent = request.agent(app.getHttpServer());

    const register = await agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E', password: 'secreto-123' })
      .expect(201);
    expect(register.body).toEqual({ user: expect.objectContaining({ email }) });
    expect(register.body.user).not.toHaveProperty('passwordHash');
    expect(register.body).not.toHaveProperty('tokens');
    expect(register.body).not.toHaveProperty('accessToken');
    expectAuthCookies(register);

    await agent.post('/api/auth/login').send({ email, password: 'secreto-123' }).expect(200);

    const refreshed = await agent.post('/api/auth/refresh').expect(200);
    expect(refreshed.body).toEqual({ user: expect.objectContaining({ email }) });
    expect(refreshed.body).not.toHaveProperty('tokens');
    expectAuthCookies(refreshed);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body).toMatchObject({ email });
  });

  it('rejects wrong password with 401 and invalid bodies with 400', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E', password: 'secreto-123' })
      .expect(201);

    await agent.post('/api/auth/login').send({ email, password: 'otra' }).expect(401);
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
    await agent
      .post('/api/auth/register')
      .send({ email: 'no-es-email', name: '', password: 'x' })
      .expect(400);
  });
});
