import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../shared/prisma/prisma.module.js';
import { BrandModule } from '../brand/brand.module.js';
import { UpsertAccountUseCase } from './application/upsert-account.use-case.js';
import { GetAccountsUseCase } from './application/get-accounts.use-case.js';
import { DisconnectAccountUseCase } from './application/disconnect-account.use-case.js';
import { GetCredentialsUseCase } from './application/get-credentials.use-case.js';
import { VerifyAccountUseCase } from './application/verify-account.use-case.js';
import { StartMetaOAuthUseCase } from './application/start-meta-oauth.use-case.js';
import { HandleMetaOAuthCallbackUseCase } from './application/handle-meta-oauth-callback.use-case.js';
import { GetMetaOAuthSessionUseCase } from './application/get-meta-oauth-session.use-case.js';
import { CompleteMetaOAuthUseCase } from './application/complete-meta-oauth.use-case.js';
import { ConnectInstagramFromFacebookUseCase } from './application/connect-instagram-from-facebook.use-case.js';
import { CONNECTED_ACCOUNTS_REPOSITORY } from './domain/ports/connected-accounts.repository.js';
import { ACCOUNT_VERIFIER } from './domain/ports/account-verifier.port.js';
import { META_OAUTH_CLIENT } from './domain/ports/meta-oauth-client.port.js';
import { META_OAUTH_SESSIONS_REPOSITORY } from './domain/ports/meta-oauth-sessions.repository.js';
import { PrismaConnectedAccountsRepository } from './infrastructure/prisma-connected-accounts.repository.js';
import { PrismaMetaOAuthSessionsRepository } from './infrastructure/prisma-meta-oauth-sessions.repository.js';
import { HttpAccountVerifier } from './infrastructure/http-account-verifier.js';
import { MetaGraphOAuthClient } from './infrastructure/meta-graph-oauth.client.js';
import {
  META_OAUTH_OPTIONS,
  resolveMetaOAuthOptions,
} from './infrastructure/meta-oauth.options.js';
import { ConnectedAccountsController } from './presentation/connected-accounts.controller.js';
import { MetaOAuthController } from './presentation/meta-oauth.controller.js';
import { MetaOAuthCallbackController } from './presentation/meta-oauth-callback.controller.js';

@Module({
  imports: [PrismaModule, BrandModule],
  controllers: [
    ConnectedAccountsController,
    MetaOAuthController,
    MetaOAuthCallbackController,
  ],
  providers: [
    UpsertAccountUseCase,
    GetAccountsUseCase,
    DisconnectAccountUseCase,
    GetCredentialsUseCase,
    VerifyAccountUseCase,
    StartMetaOAuthUseCase,
    HandleMetaOAuthCallbackUseCase,
    GetMetaOAuthSessionUseCase,
    CompleteMetaOAuthUseCase,
    ConnectInstagramFromFacebookUseCase,
    { provide: CONNECTED_ACCOUNTS_REPOSITORY, useClass: PrismaConnectedAccountsRepository },
    { provide: ACCOUNT_VERIFIER, useClass: HttpAccountVerifier },
    { provide: META_OAUTH_SESSIONS_REPOSITORY, useClass: PrismaMetaOAuthSessionsRepository },
    { provide: META_OAUTH_CLIENT, useClass: MetaGraphOAuthClient },
    {
      provide: META_OAUTH_OPTIONS,
      inject: [ConfigService],
      // `null` si falta configuración: los use cases responden 503 con guía,
      // en lugar de tumbar el arranque del API entero.
      useFactory: (configService: ConfigService) => resolveMetaOAuthOptions(configService),
    },
  ],
  exports: [GetCredentialsUseCase],
})
export class ConnectedAccountsModule {}
