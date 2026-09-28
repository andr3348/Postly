import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module.js';
import { BrandModule } from '../brand/brand.module.js';
import { UpsertAccountUseCase } from './application/upsert-account.use-case.js';
import { GetAccountsUseCase } from './application/get-accounts.use-case.js';
import { DisconnectAccountUseCase } from './application/disconnect-account.use-case.js';
import { GetCredentialsUseCase } from './application/get-credentials.use-case.js';
import { CONNECTED_ACCOUNTS_REPOSITORY } from './domain/ports/connected-accounts.repository.js';
import { PrismaConnectedAccountsRepository } from './infrastructure/prisma-connected-accounts.repository.js';
import { ConnectedAccountsController } from './presentation/connected-accounts.controller.js';

@Module({
  imports: [PrismaModule, BrandModule],
  controllers: [ConnectedAccountsController],
  providers: [
    UpsertAccountUseCase,
    GetAccountsUseCase,
    DisconnectAccountUseCase,
    GetCredentialsUseCase,
    { provide: CONNECTED_ACCOUNTS_REPOSITORY, useClass: PrismaConnectedAccountsRepository },
  ],
  exports: [GetCredentialsUseCase],
})
export class ConnectedAccountsModule {}
