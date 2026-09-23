import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { DomainExceptionFilter } from './shared/filters.js';
import { PrismaModule } from './shared/prisma/prisma.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { AuthModule } from './modules/auth/auth.module.js';

@Module({
  imports: [PrismaModule, DashboardModule, AuthModule],
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
