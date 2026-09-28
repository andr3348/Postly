import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { DomainExceptionFilter } from './shared/filters.js';
import { resolveApiEnvFilePath } from './shared/env-file-path.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './shared/prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BrandModule } from './modules/brand/brand.module.js';
import { PublicationsModule } from './modules/publications/publications.module.js';
import { ConnectedAccountsModule } from './modules/connected-accounts/connected-accounts.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BrandModule,
    PublicationsModule,
    ConnectedAccountsModule,
    // Configuración propia de Nest (`ConfigService`): carga `apps/api/.env`
    // sin `dotenv` directo. Global para no importar en cada módulo.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: resolveApiEnvFilePath(), cache: true }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Validación Zod-first (NestJS v12) como proveedor global: aplica igual
    // en producción (`main.ts`) que en tests (que no pasan por `main.ts`).
    // class-validator no se usa en código nuevo.
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
    // Errores de dominio → HTTP sin try-catch en los controllers.
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
