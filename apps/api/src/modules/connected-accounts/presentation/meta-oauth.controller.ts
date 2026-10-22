import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../../shared/decorators.js';
import { StartMetaOAuthUseCase } from '../application/start-meta-oauth.use-case.js';
import { GetMetaOAuthSessionUseCase } from '../application/get-meta-oauth-session.use-case.js';
import { CompleteMetaOAuthUseCase } from '../application/complete-meta-oauth.use-case.js';
import {
  metaOAuthCompleteSchema,
  type MetaOAuthCompleteDto,
} from './schemas/meta-oauth-complete.schema.js';

/**
 * Rutas autenticadas del OAuth de Meta. El callback vive en su propio
 * controller (`meta-oauth-callback.controller.ts`) porque es público.
 */
@Controller('brands/:brandId/accounts/meta/oauth')
export class MetaOAuthController {
  constructor(
    private readonly startMetaOAuthUseCase: StartMetaOAuthUseCase,
    private readonly getMetaOAuthSessionUseCase: GetMetaOAuthSessionUseCase,
    private readonly completeMetaOAuthUseCase: CompleteMetaOAuthUseCase,
  ) {}

  /** Devuelve la URL del diálogo de Facebook Login for Business. */
  @Get('start')
  async start(
    @Param('brandId') brandId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.startMetaOAuthUseCase.execute({ brandId, userId: user.userId });
  }

  /** Estado y páginas de la sesión (sin Page tokens). */
  @Get('sessions/:sessionId')
  async getSession(
    @Param('brandId') brandId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getMetaOAuthSessionUseCase.execute({
      brandId,
      userId: user.userId,
      sessionId,
    });
  }

  /** Persiste la página elegida como cuenta FACEBOOK. */
  @Post('sessions/:sessionId/complete')
  async complete(
    @Param('brandId') brandId: string,
    @Param('sessionId') sessionId: string,
    @Body({ schema: metaOAuthCompleteSchema }) dto: MetaOAuthCompleteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.completeMetaOAuthUseCase.execute({
      brandId,
      userId: user.userId,
      sessionId,
      pageId: dto.pageId,
    });
  }
}
