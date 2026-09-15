import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Lets `PrismaService.onModuleDestroy()` (`db.close()`) run on SIGTERM/SIGINT.
  // Do NOT call `db.close()` per-request — the pool is shared.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
