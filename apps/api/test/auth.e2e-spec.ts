import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/shared/prisma/prisma.service.js';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

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
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.client.user.deleteMany({ where: { email: { in: [email, 'no-es-email'] } } });
    await app.close();
  });

  it('register → login → refresh → me', async () => {
    const server = app.getHttpServer();

    const register = await request(server)
      .post('/auth/register')
      .send({ email, name: 'E2E', password: 'secreto-123' })
      .expect(201);
    expect(register.body.user.email).toBe(email);
    expect(register.body.user).not.toHaveProperty('passwordHash');
    expect(register.body.tokens.accessToken).toEqual(expect.any(String));

    const login = await request(server)
      .post('/auth/login')
      .send({ email, password: 'secreto-123' })
      .expect(200);
    const tokens = login.body.tokens as TokenPair;

    const refreshed = await request(server)
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken })
      .expect(200);
    const rotated = refreshed.body.tokens as TokenPair;
    expect(rotated.accessToken).toEqual(expect.any(String));

    const me = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${rotated.accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({ email });
  });

  it('rejects wrong password with 401 and invalid bodies with 400', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/auth/register')
      .send({ email, name: 'E2E', password: 'secreto-123' })
      .expect(201);

    await request(server).post('/auth/login').send({ email, password: 'otra' }).expect(401);
    await request(server).get('/auth/me').expect(401);
    await request(server)
      .post('/auth/register')
      .send({ email: 'no-es-email', name: '', password: 'x' })
      .expect(400);
  });
});
