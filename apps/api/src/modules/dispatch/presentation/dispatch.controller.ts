import { Body, Controller, HttpCode, HttpStatus, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../../shared/decorators.js';
import { ClaimDispatchUseCase } from '../application/claim-dispatch.use-case.js';
import { ReportTargetUseCase } from '../application/report-target.use-case.js';
import { N8nApiKeyGuard } from '../infrastructure/n8n-api-key.guard.js';
import { reportTargetSchema, type ReportTargetDto } from './schemas/dispatch.schema.js';

/**
 * Superficie máquina-a-máquina para n8n (NO dashboard humano), versionada
 * como `/api/v1/dispatch` (URI versioning; el resto del API va sin versión).
 * `@Public()` solo omite el guard JWT de usuarios; la auth real es
 * `N8nApiKeyGuard` (header `x-api-key`). Sin TLS en producción, ni esto basta.
 */
@Public()
@UseGuards(N8nApiKeyGuard)
@Controller({ path: 'dispatch', version: '1' })
export class DispatchController {
  constructor(
    private readonly claim: ClaimDispatchUseCase,
    private readonly report: ReportTargetUseCase,
  ) {}

  /**
   * Reclama la próxima publicación vencida con credenciales incluidas.
   * Antes expira leases vencidos (n8n que reclamó y nunca reportó: reencola o FAILED).
   * Siempre 200 con cuerpo: sin nada vencido devuelve
   * `{ publication: null, targets: [] }` (nunca 204) para que n8n distinga
   * "sin trabajo" con una señal explícita y no con un cuerpo ausente.
   * `@Res()` puro: con passthrough Nest responde el `undefined` de vuelta
   * y desmonta headers ya enviados (ERR_HTTP_HEADERS_SENT intermitente).
   */
  @Post('claim')
  async claimNext(@Res() res: Response): Promise<void> {
    const claim = await this.claim.execute();
    if (claim === null) {
      res.status(HttpStatus.OK).json({ publication: null, targets: [] });
      return;
    }
    res.status(HttpStatus.OK).json(claim);
  }

  @Post('targets/:targetId/report')
  @HttpCode(HttpStatus.OK)
  reportTarget(
    @Param('targetId') targetId: string,
    @Body({ schema: reportTargetSchema }) body: ReportTargetDto,
  ) {
    return this.report.execute({ targetId, ...body });
  }
}
