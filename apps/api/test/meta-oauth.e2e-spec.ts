import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/shared/prisma/prisma.service.js';
import { setupApp } from './../src/setup-app.js';
import { encrypt } from './../src/shared/encryption.js';
import { MetaOAuthError } from './../src/shared/errors.js';
import {
  META_OAUTH_CLIENT,
  type MetaOAuthClient,
} from './../src/modules/connected-accounts/domain/ports/meta-oauth-client.port.js';
import type { MetaInstagramAsset, MetaPageAsset } from './../src/modules/connected-accounts/domain/meta-oauth.entity.js';

/**
 * OAuth de Meta: start → callback (302) → sesión READY → completar página →
 * conectar Instagram desde Facebook → cascada al desconectar Facebook.
 * El cliente HTTP de Meta se reemplaza por un fake: cero llamadas reales.
 * Los Page tokens entran por el payload cifrado pero jamás salen en el JSON.
 */
describe('MetaOAuth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: string;
  let brandId: string | undefined;
  let instagramResult: MetaInstagramAsset | null;

  const PAGE: MetaPageAsset = {
    id: 'page-e2e-1',
    name: 'Página E2E',
    accessToken: 'page-token-e2e-1',
    tasks: ['MANAGE'],
    instagram: { id: 'ig-e2e-1', username: 'ig_e2e' },
  };

  const fakeMetaClient: MetaOAuthClient = {
    buildAuthorizationUrl: (state) =>
      `https://www.facebook.com/v25.0/dialog/oauth?client_id=e2e&state=${encodeURIComponent(state)}`,
    buildFrontendUrl: (path) => `http://localhost:3000${path}`,
    exchangeCodeForLongLivedUserToken: async (code) => {
      if (code !== 'valid-code') {
        throw new MetaOAuthError('META_OAUTH_EXCHANGE_FAILED', 'Código inválido.');
      }
      return 'long-lived-user-token';
    },
    listPages: async () => [PAGE],
    debugPageToken: async () => ({
      isValid: true,
      expiresAt: null,
      scopes: ['pages_show_list', 'pages_manage_posts'],
    }),
    getPageInstagram: async () => instagramResult,
  };

  beforeEach(async () => {
    instagramResult = PAGE.instagram;
    email = `e2e-meta-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@postly.test`;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(META_OAUTH_CLIENT)
      .useValue(fakeMetaClient)
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

  async function registerAndCreateBrand(): Promise<ReturnType<typeof request.agent>> {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E Meta', password: 'secreto-123' })
      .expect(201);
    const brand = await agent.post('/api/brands').send({ name: 'Marca Meta E2E' }).expect(201);
    brandId = brand.body.brand.id as string;
    return agent;
  }

  it('start requires auth', async () => {
    await request(app.getHttpServer())
      .get('/api/brands/whatever/accounts/meta/oauth/start')
      .expect(401);
  });

  it('connects Facebook via OAuth, then Instagram from Facebook, then cascades disconnect', async () => {
    const agent = await registerAndCreateBrand();

    // 1) start: URL del diálogo con state aleatorio.
    const start = await agent
      .get(`/api/brands/${brandId}/accounts/meta/oauth/start`)
      .expect(200);
    const state = new URL(start.body.authorizationUrl as string).searchParams.get('state');
    expect(state).not.toBeNull();

    // La base guarda solo el hash del state.
    const rawSession = await prisma.client.metaOAuthSession.findFirst({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
    });
    expect(rawSession).not.toBeNull();
    expect(rawSession?.stateHash).not.toBe(state);

    // 2) callback público: 302 al dashboard con la sesión.
    const callback = await agent
      .get('/api/connected-accounts/meta/oauth/callback')
      .query({ code: 'valid-code', state })
      .expect(302);
    const redirectUrl = new URL(callback.headers.location ?? '');
    const sessionId = redirectUrl.searchParams.get('meta_session');
    expect(sessionId).not.toBeNull();
    expect(redirectUrl.searchParams.get('meta_brand')).toBe(brandId);

    // El state ya no se puede reusar.
    const replay = await agent
      .get('/api/connected-accounts/meta/oauth/callback')
      .query({ code: 'valid-code', state })
      .expect(302);
    expect(replay.headers.location).toContain('meta_error=expired');

    // 3) sesión READY con páginas, sin Page tokens.
    const session = await agent
      .get(`/api/brands/${brandId}/accounts/meta/oauth/sessions/${sessionId}`)
      .expect(200);
    expect(session.body).toMatchObject({ status: 'READY' });
    expect(session.body.pages).toEqual([
      {
        id: PAGE.id,
        name: PAGE.name,
        instagram: { id: 'ig-e2e-1', username: 'ig_e2e' },
      },
    ]);
    expect(JSON.stringify(session.body)).not.toContain(PAGE.accessToken);

    // 4) completar: se persiste Facebook con token cifrado.
    const completed = await agent
      .post(`/api/brands/${brandId}/accounts/meta/oauth/sessions/${sessionId}/complete`)
      .send({ pageId: PAGE.id })
      .expect(201);
    expect(completed.body.account).toMatchObject({
      platform: 'FACEBOOK',
      status: 'CONNECTED',
      authType: 'META_OAUTH',
      metaPageId: PAGE.id,
    });
    expect(completed.body.instagram).toEqual({ id: 'ig-e2e-1', username: 'ig_e2e' });
    expect(JSON.stringify(completed.body)).not.toContain(PAGE.accessToken);

    const facebook = await prisma.client.connectedAccount.findUnique({
      where: { brandId_platform: { brandId: brandId!, platform: 'FACEBOOK' } },
    });
    expect(facebook?.authType).toBe('META_OAUTH');
    expect(facebook?.metaPageId).toBe(PAGE.id);
    // Cifrado en reposo: nunca el token en claro.
    expect(facebook?.accessToken).not.toBe(PAGE.accessToken);
    expect(facebook?.accessToken).toContain(':');
    const storedSession = await prisma.client.metaOAuthSession.findUnique({
      where: { id: sessionId! },
    });
    expect(storedSession?.status).toBe('COMPLETED');
    expect(storedSession?.encryptedPayload).toBeNull();

    // 5) Instagram depende de Facebook: se conecta con el Page token guardado.
    const instagram = await agent
      .post(`/api/brands/${brandId}/accounts/instagram/from-facebook`)
      .expect(201);
    expect(instagram.body).toMatchObject({
      platform: 'INSTAGRAM',
      status: 'CONNECTED',
      authType: 'META_OAUTH',
      metaPageId: PAGE.id,
      accountName: 'ig_e2e',
      externalAccountId: 'ig-e2e-1',
    });
    expect(JSON.stringify(instagram.body)).not.toContain(PAGE.accessToken);

    const listed = await agent.get(`/api/brands/${brandId}/accounts`).expect(200);
    expect(listed.body).toHaveLength(2);
    expect(JSON.stringify(listed.body)).not.toContain(PAGE.accessToken);
    expect(JSON.stringify(listed.body)).not.toContain('page-token');

    // 6) Desconectar Facebook también desvincula Instagram (comparten token).
    await agent.delete(`/api/brands/${brandId}/accounts/FACEBOOK`).expect(204);
    const afterDisconnect = await prisma.client.connectedAccount.findMany({
      where: { brandId },
    });
    expect(afterDisconnect).toHaveLength(2);
    expect(afterDisconnect.every((account) => account.status === 'DISCONNECTED')).toBe(true);
    expect(afterDisconnect.every((account) => account.accessToken === null)).toBe(true);
  });

  it('rejects Instagram without Facebook first', async () => {
    const agent = await registerAndCreateBrand();

    const response = await agent
      .post(`/api/brands/${brandId}/accounts/instagram/from-facebook`)
      .expect(409);
    expect(response.body.code).toBe('META_FACEBOOK_NOT_CONNECTED');
  });

  it('rejects Instagram when the page has no linked professional account', async () => {
    const agent = await registerAndCreateBrand();
    instagramResult = null;

    // Facebook conectado a mano (mismo cifrado que usa el adaptador real).
    const encryptionKey = process.env['ENCRYPTION_KEY'] ?? 'ab'.repeat(32);
    await prisma.client.connectedAccount.create({
      data: {
        brandId: brandId!,
        platform: 'FACEBOOK',
        status: 'CONNECTED',
        authType: 'META_OAUTH',
        metaPageId: PAGE.id,
        accountName: PAGE.name,
        externalAccountId: PAGE.id,
        accessToken: encrypt(PAGE.accessToken, encryptionKey),
      },
    });

    const response = await agent
      .post(`/api/brands/${brandId}/accounts/instagram/from-facebook`)
      .expect(400);
    expect(response.body.code).toBe('META_INSTAGRAM_NOT_LINKED');
  });
});
