import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../shared/prisma/prisma.module.js';
import { AuthSessionIssuer } from './application/auth-session-issuer.js';
import { GetMeUseCase } from './application/get-me.use-case.js';
import { ListAuthSessionsUseCase } from './application/list-auth-sessions.use-case.js';
import { LoginUseCase } from './application/login.use-case.js';
import { LogoutUseCase } from './application/logout.use-case.js';
import { RefreshUseCase } from './application/refresh.use-case.js';
import { RegisterUseCase } from './application/register.use-case.js';
import { RevokeAuthSessionUseCase } from './application/revoke-auth-session.use-case.js';
import { RevokeOtherSessionsUseCase } from './application/revoke-other-sessions.use-case.js';
import { AUTH_SESSIONS_REPOSITORY } from './domain/ports/auth-sessions.repository.js';
import { TOKEN_ISSUER } from './domain/ports/token-issuer.port.js';
import { PASSWORD_HASHER } from './domain/ports/password-hasher.port.js';
import { REFRESH_TOKEN_SERVICE } from './domain/ports/refresh-token.service.js';
import { SESSION_ISSUER } from './domain/ports/session-issuer.port.js';
import { USERS_REPOSITORY } from './domain/ports/users.repository.js';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher.js';
import {
  AUTH_JWT_OPTIONS,
  resolveAuthJwtOptions,
} from './infrastructure/auth-jwt.options.js';
import { CryptoRefreshTokenService } from './infrastructure/crypto-refresh-token.service.js';
import { JwtAuthGuard } from './infrastructure/jwt-auth.guard.js';
import { JwtTokenIssuer } from './infrastructure/jwt-token-issuer.js';
import { PrismaAuthSessionsRepository } from './infrastructure/prisma-auth-sessions.repository.js';
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
    LogoutUseCase,
    GetMeUseCase,
    ListAuthSessionsUseCase,
    RevokeAuthSessionUseCase,
    RevokeOtherSessionsUseCase,
    AuthSessionIssuer,
    JwtAuthGuard,
    // Guard global: todo queda protegido salvo rutas con `@Public()`.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: USERS_REPOSITORY, useClass: PrismaUsersRepository },
    {
      provide: AUTH_SESSIONS_REPOSITORY,
      useClass: PrismaAuthSessionsRepository,
    },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: REFRESH_TOKEN_SERVICE, useClass: CryptoRefreshTokenService },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
    { provide: SESSION_ISSUER, useExisting: AuthSessionIssuer },
    {
      provide: AUTH_JWT_OPTIONS,
      inject: [ConfigService],
      useFactory: resolveAuthJwtOptions,
    },
  ],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
