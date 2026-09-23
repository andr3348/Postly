import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../shared/prisma/prisma.module.js';
import { LoginUseCase } from './application/login.use-case.js';
import { RefreshUseCase } from './application/refresh.use-case.js';
import { RegisterUseCase } from './application/register.use-case.js';
import { TOKEN_ISSUER } from './domain/ports/token-issuer.port.js';
import { PASSWORD_HASHER } from './domain/ports/password-hasher.port.js';
import { USERS_REPOSITORY } from './domain/ports/users.repository.js';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.js';
import {
  AUTH_JWT_OPTIONS,
  resolveAuthJwtOptions,
} from './infrastructure/auth-jwt.options.js';
import { JwtAuthGuard } from './infrastructure/jwt-auth.guard.js';
import { JwtTokenIssuer } from './infrastructure/jwt-token-issuer.js';
import { PrismaUsersRepository } from './infrastructure/prisma-users.repository.js';
import { AuthController } from './presentation/auth.controller.js';

/**
 * Módulo auth (Clean Architecture): domain ← application ← infrastructure,
 * presentation solo delega. Puertos con Symbol, adaptadores intercambiables.
 * Exporta el guard para proteger rutas de otros módulos.
 */
@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    RegisterUseCase,
    LoginUseCase,
    RefreshUseCase,
    JwtAuthGuard,
    // Guard global: todo queda protegido salvo rutas con `@Public()`.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: USERS_REPOSITORY, useClass: PrismaUsersRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
    { provide: AUTH_JWT_OPTIONS, useFactory: resolveAuthJwtOptions },
  ],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
