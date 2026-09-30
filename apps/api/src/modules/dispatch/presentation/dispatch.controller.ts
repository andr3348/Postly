import { Body, Controller, HttpCode, HttpStatus, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../../shared/decorators.js';
import {
  ClaimDispatchUseCase,
  type DispatchClaim,
} from '../application/claim-dispatch.use-case.js';
import { ReportTargetUseCase } from '../application/report-target.use-case.js';
import { N8nApiKeyGuard } from '../infrastructure/n8n-api-key.guard.js';
import { reportTargetSchema, type ReportTargetDto } from './schemas/dispatch.schema.js';

/**
 * Superficie máquina-a-máquina para n8n (NO dashboard humano).
 * `@Public()` solo omite el guard JWT de usuarios; la auth real es
 * `N8nApiKeyGuard` (header `x-api-key`). Sin TLS en producción, ni esto basta.
 */
@Public()
@UseGuards(N8nApiKeyGuard)
@Controller('dispatch')
export class DispatchController {
  constructor(
    private readonly claim: ClaimDispatchUseCase,
    private readonly report: ReportTargetUseCase,
  ) {}

  /**
   * Reclama la próxima publicación vencida con credenciales incluidas.
   * 204 sin cuerpo = nada por hacer (n8n espera al siguiente poll).
   */
  @Post('claim')
  @HttpCode(HttpStatus.OK)
  async claimNext(
    @Res({ passthrough: true }) res: Response,
  ): Promise<DispatchClaim | undefined> {
    const claim = await this.claim.execute();
    if (claim === null) {
      res.status(HttpStatus.NO_CONTENT).send();
      return undefined;
    }
    return claim;
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
