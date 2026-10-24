import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/shared/prisma/prisma.service.js';
import { setupApp } from './../src/setup-app.js';

interface HttpResponseLike {
  headers: Record<string, string | string[] | undefined>;
}

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
    await prisma.client.user.deleteMany({
      where: { email: { in: [email, 'no-es-email'] } },
    });
    await app.close();
  });

  function setCookiesOf(response: HttpResponseLike): string[] {
    const raw = response.headers['set-cookie'];
    return Array.isArray(raw) ? raw : [];
  }

  function setCookieOf(
    response: HttpResponseLike,
    name: string,
  ): string | undefined {
    return setCookiesOf(response).find((cookie) =>
      cookie.startsWith(`${name}=`),
    );
  }

  function cookieValueOf(
    response: HttpResponseLike,
    name: string,
  ): string | null {
    const cookie = setCookieOf(response, name);
    if (cookie === undefined) return null;
    return cookie.slice(name.length + 1).split(';')[0] ?? null;
  }

  function expectAuthCookies(
    response: HttpResponseLike,
    options: { persistent: boolean },
  ): void {
    const access = setCookieOf(response, 'accessToken');
    const refresh = setCookieOf(response, 'refreshToken');
    expect(access).toContain('HttpOnly');
    expect(refresh).toContain('HttpOnly');
    if (options.persistent) {
      expect(access).toContain('Max-Age=');
      expect(refresh).toContain('Max-Age=');
    } else {
      expect(access).not.toContain('Max-Age=');
      expect(refresh).not.toContain('Max-Age=');
    }
  }

  function sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  async function register(agent: ReturnType<typeof request.agent>) {
    return agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E', password: 'secreto-123' })
      .expect(201);
  }

  it('register → login → refresh → me (solo cookies, sin tokens en JSON)', async () => {
    const agent = request.agent(app.getHttpServer());

    const registerResponse = await register(agent);
    expect(registerResponse.body).toEqual({
      user: expect.objectContaining({ email }),
    });
    expect(registerResponse.body.user).not.toHaveProperty('passwordHash');
    expect(registerResponse.body).not.toHaveProperty('tokens');
    expect(registerResponse.body).not.toHaveProperty('accessToken');
    // El registro no tiene "Mantener sesión activa": cookies de sesión.
    expectAuthCookies(registerResponse, { persistent: false });

    const login = await agent
      .post('/api/auth/login')
      .send({ email, password: 'secreto-123', rememberMe: true })
      .expect(200);
    expectAuthCookies(login, { persistent: true });

    const refreshed = await agent.post('/api/auth/refresh').expect(200);
    expect(refreshed.body).toEqual({
      user: expect.objectContaining({ email }),
    });
    expect(refreshed.body).not.toHaveProperty('tokens');
    expectAuthCookies(refreshed, { persistent: true });

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body).toMatchObject({ email });
  });

  it('rejects wrong passwords and invalid bodies', async () => {
    const agent = request.agent(app.getHttpServer());
    await register(agent);

    await agent
      .post('/api/auth/login')
      .send({ email, password: 'otra' })
      .expect(401);
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
    await agent
      .post('/api/auth/register')
      .send({ email: 'no-es-email', name: '', password: 'x' })
      .expect(400);
  });

  it('lists sessions per device and revokes one immediately', async () => {
    const laptop = request.agent(app.getHttpServer());
    const phone = request.agent(app.getHttpServer());
    await register(laptop);
    await phone.post('/api/auth/login').send({ email, password: 'secreto-123' }).expect(200);

    const list = await laptop.get('/api/auth/sessions').expect(200);
    expect(list.body).toHaveLength(2);
    expect(list.body.filter((session: { current: boolean }) => session.current)).toHaveLength(1);
    expect(list.body[0]).not.toHaveProperty('userId');
    expect(list.body[0]).not.toHaveProperty('tokenHash');

    const phoneSession = list.body.find(
      (session: { current: boolean }) => session.current === false,
    ) as { id: string } | undefined;
    expect(phoneSession).toBeDefined();

    await laptop.delete(`/api/auth/sessions/${phoneSession!.id}`).expect(204);
    // El access de la sesión revocada sigue firmado y vigente, pero el guard
    // consulta la BD: la revocación es inmediata.
    await phone.get('/api/auth/me').expect(401);
    await phone.post('/api/auth/refresh').expect(401);
    await laptop.get('/api/auth/me').expect(200);
  });

  it('closes all other sessions keeping the current one', async () => {
    const laptop = request.agent(app.getHttpServer());
    const phone = request.agent(app.getHttpServer());
    await register(laptop);
    await phone.post('/api/auth/login').send({ email, password: 'secreto-123' }).expect(200);

    await laptop.post('/api/auth/sessions/revoke-others').expect(204);

    await phone.get('/api/auth/me').expect(401);
    await laptop.get('/api/auth/me').expect(200);
    const remaining = await laptop.get('/api/auth/sessions').expect(200);
    expect(remaining.body).toHaveLength(1);
  });

  it('logout revokes the session server-side and is idempotent', async () => {
    const agent = request.agent(app.getHttpServer());
    await register(agent);

    const logout = await agent.post('/api/auth/logout').expect(204);
    expect(setCookieOf(logout, 'refreshToken')).toContain('refreshToken=;');
    await agent.get('/api/auth/me').expect(401);
    await agent.post('/api/auth/refresh').expect(401);
    await agent.post('/api/auth/logout').expect(204);
  });

  it('detects refresh token reuse and revokes the session', async () => {
    const agent = request.agent(app.getHttpServer());
    const registered = await register(agent);
    const firstRefresh = cookieValueOf(registered, 'refreshToken');
    expect(firstRefresh).not.toBeNull();

    // Uso legítimo: rota el refresh y el agent se queda con el nuevo.
    await agent.post('/api/auth/refresh').expect(200);

    // Dentro de la ventana de gracia (pestañas concurrentes) se rechaza sin
    // tumbar la sesión.
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${firstRefresh!}`)
      .expect(401);
    await agent.get('/api/auth/me').expect(200);

    // Fuera de la ventana de gracia = reuso: se revoca la sesión completa.
    await prisma.client.refreshToken.update({
      where: { tokenHash: sha256(firstRefresh!) },
      data: { usedAt: new Date(Date.now() - 60_000) },
    });
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${firstRefresh!}`)
      .expect(401);
    await agent.get('/api/auth/me').expect(401);
    await agent.post('/api/auth/refresh').expect(401);
  });
});
