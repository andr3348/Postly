import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // El pipe global de validación Zod vive en `AppModule` (APP_PIPE) para
  // que aplique igual en producción que en tests.
  // Lets `PrismaService.onModuleDestroy()` (`$disconnect()`) run on SIGTERM/SIGINT.
  // Never disconnect per-request — the client pool is shared.
  app.enableShutdownHooks();

  app.setGlobalPrefix('api'); // /api/auth, /api/dashboard, etc.

  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
