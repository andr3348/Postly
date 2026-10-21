import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/shared/prisma/prisma.service.js';
import { setupApp } from './../src/setup-app.js';

/** Datos mínimos por plataforma para conectar una cuenta en el seed e2e. */
const ACCOUNT_SEED = {
  LINKEDIN: { accountName: 'marcaoficial', externalAccountId: 'urn:li:org:9' },
  FACEBOOK: { accountName: 'paginaoficial', externalAccountId: 'page-9' },
  INSTAGRAM: { accountName: 'instagramoficial', externalAccountId: 'ig-9' },
} as const;

/**
 * Simula el worker n8n: reclama con x-api-key, publica (simulado) y reporta.
 * Sin API key → 401 incluso en rutas @Public (el guard JWT se omite,
 * pero el de servicio no). Cubre también el lease: sin reportes la pieza se
 * reencola (recuperación automática); con reportes parciales se cierra sin
 * reintento para no duplicar.
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

  /** Cliente máquina-a-máquina (header `x-api-key`). */
  const n8n = (method: 'post' | 'get', url: string) =>
    request(app.getHttpServer())[method](url).set('x-api-key', apiKey);

  /**
   * Deja publicaciones vencidas y reclamables (una por plataforma): usuario
   * registrado, marca, cuentas conectadas, targets, submit y aprobación con
   * fecha pasada.
   */
  async function seedClaimablePublication(
    agent: ReturnType<typeof request.agent>,
    platforms: Array<keyof typeof ACCOUNT_SEED> = ['LINKEDIN'],
    mediaType: 'IMAGE' | 'VIDEO' = 'IMAGE',
  ): Promise<void> {
    await agent
      .post('/api/auth/register')
      .send({ email, name: 'E2E N8N', password: 'secreto-123' })
      .expect(201);

    const brand = await agent.post('/api/brands').send({ name: 'Marca N8N' }).expect(201);
    brandId = brand.body.brand.id as string;

    for (const platform of platforms) {
      await agent
        .post(`/api/brands/${brandId}/accounts`)
        .send({ platform, ...ACCOUNT_SEED[platform], accessToken: 'live-token-e2e' })
        .expect(201);
    }

    const created = await agent
      .post('/api/publications')
      .send({
        brandId,
        originalPrompt: 'Post n8n',
        title: 'Título n8n',
        copy: 'Copy n8n',
        mediaUrl: 'https://postly.test/n8n.jpg',
        mediaType,
      })
      .expect(201);
    publicationId = created.body.id as string;

    for (const platform of platforms) {
      await agent
        .post(`/api/publications/${publicationId}/targets`)
        .send({ platform })
        .expect(201);
    }
    await agent.post(`/api/publications/${publicationId}/submit`).expect(200);

    await prisma.client.user.update({ where: { email }, data: { role: 'ADMIN' } });
    await agent.post('/api/auth/login').send({ email, password: 'secreto-123' }).expect(200);
    // Vencida a propósito: el claim solo toma scheduledAt pasado.
    await agent
      .post(`/api/publications/${publicationId}/approve`)
      .send({ scheduledAt: '2020-01-01T09:00:00.000Z' })
      .expect(200);
  }

  it('claim → report SUCCESS with metrics → PUBLISHED', async () => {
    const agent = request.agent(app.getHttpServer());
    await seedClaimablePublication(agent);

    // Sin API key: 401 (aunque la ruta sea @Public para el guard JWT).
    await request(app.getHttpServer()).post('/api/v1/dispatch/claim').expect(401);

    const claim = await n8n('post', '/api/v1/dispatch/claim').expect(200);
    expect(claim.body.publication).toMatchObject({ id: publicationId, status: 'PROCESSING' });
    expect(claim.body.targets).toHaveLength(1);
    expect(claim.body.targets[0].credentials.accessToken).toBe('live-token-e2e');
    // Caption lista para publicar: el backend fusiona título + descripción.
    expect(claim.body.targets[0].caption).toBe('Título n8n\n\nCopy n8n');
    expect(claim.body.publication.dispatchAttemptId).toMatch(/^[0-9a-f-]{36}$/);

    // Nada más vencido: 200 con sobre vacío explícito (n8n distingue por
    // `publication === null`, nunca por un cuerpo ausente).
    const empty = await n8n('post', '/api/v1/dispatch/claim').expect(200);
    expect(empty.body).toEqual({ publication: null, targets: [] });

    const targetId = claim.body.targets[0].target.id as string;
    const reported = await n8n('post', `/api/v1/dispatch/targets/${targetId}/report`)
      .send({
        dispatchAttemptId: claim.body.publication.dispatchAttemptId,
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

  it('claim exposes the target format for video reels', async () => {
    const agent = request.agent(app.getHttpServer());
    await seedClaimablePublication(agent, ['FACEBOOK'], 'VIDEO');

    const claim = await n8n('post', '/api/v1/dispatch/claim').expect(200);
    expect(claim.body.targets[0].target).toMatchObject({
      platform: 'FACEBOOK',
      format: 'REEL',
    });

    const targetId = claim.body.targets[0].target.id as string;
    await n8n('post', `/api/v1/dispatch/targets/${targetId}/report`)
      .send({
        dispatchAttemptId: claim.body.publication.dispatchAttemptId,
        status: 'SUCCESS',
        externalPostId: 'fb-reel-e2e',
      })
      .expect(200);
  });

  it('lease vencido sin reportes: la misma pieza se re-entrega (reintento)', async () => {
    const agent = request.agent(app.getHttpServer());
    await seedClaimablePublication(agent);

    const claim = await n8n('post', '/api/v1/dispatch/claim').expect(200);
    expect(claim.body.publication).toMatchObject({ id: publicationId, status: 'PROCESSING' });
    const targetId = claim.body.targets[0].target.id as string;
    const oldAttemptId = claim.body.publication.dispatchAttemptId as string;

    // n8n "muere" antes de publicar y el lease (15 min) expira: envejecemos 20.
    await prisma.client.publication.update({
      where: { id: publicationId },
      data: { dispatchedAt: new Date(Date.now() - 20 * 60_000) },
    });

    // Sin ningún reporte: el mismo claim la reencola y la re-entrega al toque.
    const reclaimed = await n8n('post', '/api/v1/dispatch/claim').expect(200);
    expect(reclaimed.body.publication).toMatchObject({ id: publicationId, status: 'PROCESSING' });
    expect(reclaimed.body.publication.dispatchAttemptId).not.toBe(oldAttemptId);
    expect(reclaimed.body.targets).toHaveLength(1);
    expect(reclaimed.body.targets[0].target.id).toBe(targetId);

    // El lease quedó renovado: no vuelve a expirar de inmediato.
    const publication = await prisma.client.publication.findUnique({
      where: { id: publicationId },
    });
    expect(publication?.dispatchedAt?.getTime() ?? 0).toBeGreaterThan(Date.now() - 60_000);
  });

  it('retry only the failed Instagram target and keeps Facebook published', async () => {
    const agent = request.agent(app.getHttpServer());
    await seedClaimablePublication(agent, ['FACEBOOK', 'INSTAGRAM']);

    const claim = await n8n('post', '/api/v1/dispatch/claim').expect(200);
    const oldAttemptId = claim.body.publication.dispatchAttemptId as string;
    const entries = claim.body.targets as Array<{
      target: { id: string; platform: string };
    }>;
    const facebook = entries.find((entry) => entry.target.platform === 'FACEBOOK');
    const instagram = entries.find((entry) => entry.target.platform === 'INSTAGRAM');
    expect(facebook).toBeDefined();
    expect(instagram).toBeDefined();

    await n8n('post', `/api/v1/dispatch/targets/${facebook!.target.id}/report`)
      .send({
        dispatchAttemptId: oldAttemptId,
        status: 'SUCCESS',
        externalPostId: 'fb-keep-e2e',
      })
      .expect(200);

    const failed = await n8n(
      'post',
      `/api/v1/dispatch/targets/${instagram!.target.id}/report`,
    )
      .send({
        dispatchAttemptId: oldAttemptId,
        status: 'FAILED',
        stage: 'PUBLISH',
        errorMessage:
          '400 - {"error":{"message":"Please reduce the amount of data","type":"OAuthException","code":4,"fbtrace_id":"trace-e2e"}}',
      })
      .expect(200);
    expect(failed.body).toMatchObject({
      terminal: true,
      publication: { status: 'PARTIAL' },
    });

    const stored = await prisma.client.publicationTarget.findMany({
      where: { publicationId },
    });
    expect(stored.find((target) => target.platform === 'INSTAGRAM')?.failure).toMatchObject({
      kind: 'RATE_LIMIT',
      retryable: true,
    });

    const retried = await agent
      .post(`/api/publications/${publicationId}/retry`)
      .send({ platforms: ['INSTAGRAM'] })
      .expect(202);
    expect(retried.body).toMatchObject({
      status: 'SCHEDULED',
      dispatchAttemptId: null,
    });

    const afterRetry = await agent
      .get(`/api/publications/${publicationId}/targets`)
      .expect(200);
    expect(
      afterRetry.body.find((target: { platform: string }) => target.platform === 'FACEBOOK'),
    ).toMatchObject({ status: 'SUCCESS', externalPostId: 'fb-keep-e2e' });
    expect(
      afterRetry.body.find((target: { platform: string }) => target.platform === 'INSTAGRAM'),
    ).toMatchObject({ status: 'PENDING', retryCount: 1, failure: null });

    const retryClaim = await n8n('post', '/api/v1/dispatch/claim').expect(200);
    expect(retryClaim.body.publication.dispatchAttemptId).not.toBe(oldAttemptId);
    expect(retryClaim.body.targets).toHaveLength(1);
    expect(retryClaim.body.targets[0].target).toMatchObject({
      id: instagram!.target.id,
      platform: 'INSTAGRAM',
    });

    // Un reporte del intento viejo ya no puede tocar la publicación.
    await n8n('post', `/api/v1/dispatch/targets/${instagram!.target.id}/report`)
      .send({
        dispatchAttemptId: oldAttemptId,
        status: 'SUCCESS',
        externalPostId: 'stale-e2e',
      })
      .expect(409);

    const done = await n8n(
      'post',
      `/api/v1/dispatch/targets/${instagram!.target.id}/report`,
    )
      .send({
        dispatchAttemptId: retryClaim.body.publication.dispatchAttemptId,
        status: 'SUCCESS',
        externalPostId: 'ig-retry-e2e',
      })
      .expect(200);
    expect(done.body).toMatchObject({
      terminal: true,
      publication: { status: 'PUBLISHED' },
    });
  });

  it('lease vencido con un reporte parcial: cierra lo faltante sin reintento', async () => {
    const agent = request.agent(app.getHttpServer());
    await seedClaimablePublication(agent, ['LINKEDIN', 'FACEBOOK']);

    const claim = await n8n('post', '/api/v1/dispatch/claim').expect(200);
    const linkedin = claim.body.targets.find(
      (entry: { target: { platform: string } }) => entry.target.platform === 'LINKEDIN',
    );
    expect(linkedin).toBeDefined();

    // n8n alcanzó a reportar LINKEDIN (FACEBOOK sigue pendiente) y murió.
    const reported = await n8n('post', `/api/v1/dispatch/targets/${linkedin.target.id}/report`)
      .send({
        dispatchAttemptId: claim.body.publication.dispatchAttemptId,
        status: 'SUCCESS',
        externalPostId: 'urn:li:share:e2e',
      })
      .expect(200);
    expect(reported.body).toMatchObject({ terminal: false });

    await prisma.client.publication.update({
      where: { id: publicationId },
      data: { dispatchedAt: new Date(Date.now() - 20 * 60_000) },
    });

    // Ya hay reportes: no se re-entrega; FACEBOOK queda FAILED y la pub PARTIAL.
    const empty = await n8n('post', '/api/v1/dispatch/claim').expect(200);
    expect(empty.body).toEqual({ publication: null, targets: [] });

    const publication = await prisma.client.publication.findUnique({
      where: { id: publicationId },
    });
    expect(publication?.status).toBe('PARTIAL');
    const targets = await prisma.client.publicationTarget.findMany({ where: { publicationId } });
    const facebook = targets.find((target) => target.platform === 'FACEBOOK');
    expect(facebook).toMatchObject({ status: 'FAILED' });
    expect(facebook?.errorMessage).toContain('Despacho vencido');
    expect(targets.find((target) => target.platform === 'LINKEDIN')).toMatchObject({
      status: 'SUCCESS',
    });
  });
});
