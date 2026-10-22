import { Controller, Get, HttpStatus, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../../shared/decorators.js';
import { HandleMetaOAuthCallbackUseCase } from '../application/handle-meta-oauth-callback.use-case.js';
import {
  metaOAuthCallbackQuerySchema,
  type MetaOAuthCallbackQueryDto,
} from './schemas/meta-oauth-callback.schema.js';

/**
 * Callback público: el navegador vuelve desde facebook.com y puede no traer
 * JWT vigente (el access token dura 15 minutos). La seguridad la da el
 * `state`: aleatorio, hasheado, de un solo uso y con TTL de 10 minutos.
 * Siempre responde 302 al dashboard; nunca JSON de error a la cara del usuario.
 */
@Controller('connected-accounts/meta/oauth')
export class MetaOAuthCallbackController {
  constructor(
    private readonly handleMetaOAuthCallbackUseCase: HandleMetaOAuthCallbackUseCase,
  ) {}

  @Public()
  @Get('callback')
  async callback(
    @Query({ schema: metaOAuthCallbackQuerySchema }) query: MetaOAuthCallbackQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.handleMetaOAuthCallbackUseCase.execute({
      code: query.code,
      state: query.state,
      error: query.error,
      errorDescription: query.error_description,
    });
    response.redirect(HttpStatus.FOUND, result.redirectUrl);
  }
}
