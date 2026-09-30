import { Module } from '@nestjs/common';
import { ConnectedAccountsModule } from '../connected-accounts/connected-accounts.module.js';
import { PublicationsModule } from '../publications/publications.module.js';
import { ClaimDispatchUseCase } from './application/claim-dispatch.use-case.js';
import { ReportTargetUseCase } from './application/report-target.use-case.js';
import { DISPATCH_CREDENTIALS } from './domain/ports/dispatch-credentials.port.js';
import { CredentialsViaAccountsModule } from './infrastructure/credentials-via-accounts.adapter.js';
import { N8nApiKeyGuard } from './infrastructure/n8n-api-key.guard.js';
import { DispatchController } from './presentation/dispatch.controller.js';

/**
 * Módulo dispatch: superficie exclusiva de n8n. Reutiliza puertos de
 * Publications y el caso de uso de credenciales; no tiene persistencia propia.
 */
@Module({
  imports: [PublicationsModule, ConnectedAccountsModule],
  controllers: [DispatchController],
  providers: [
    ClaimDispatchUseCase,
    ReportTargetUseCase,
    N8nApiKeyGuard,
    { provide: DISPATCH_CREDENTIALS, useClass: CredentialsViaAccountsModule },
  ],
})
export class DispatchModule {}
