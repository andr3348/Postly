import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { UpsertAccountUseCase } from '../application/upsert-account.use-case.js';
import { GetAccountsUseCase } from '../application/get-accounts.use-case.js';
import { DisconnectAccountUseCase } from '../application/disconnect-account.use-case.js';
import type { AccountPlatform } from '../domain/connected-account.entity.js';
import {
  accountPlatformSchema,
  connectAccountSchema,
  type ConnectAccountDto,
} from './schemas/connect-account.schema.js';

/**
 * Controller delgado: valida (Zod), delega al caso de uso y retorna.
 * Las credenciales entran por el cuerpo pero jamás salen: el listado
 * las excluye por `select` en el adaptador.
 */
@Controller('brands/:brandId/accounts')
export class ConnectedAccountsController {
  constructor(
    private readonly upsertAccountUseCase: UpsertAccountUseCase,
    private readonly getAccountsUseCase: GetAccountsUseCase,
    private readonly disconnectAccountUseCase: DisconnectAccountUseCase,
  ) {}

  @Post()
  async upsertAccount(
    @Param('brandId') brandId: string,
    @Body({ schema: connectAccountSchema }) dto: ConnectAccountDto,
  ) {
    return this.upsertAccountUseCase.execute({ brandId, ...dto });
  }

  @Get()
  async findAllByBrand(@Param('brandId') brandId: string) {
    return this.getAccountsUseCase.execute(brandId);
  }

  @Delete(':platform')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnectAccount(
    @Param('brandId') brandId: string,
    // El pipe valida contra el schema: si llega aquí, es valor del enum.
    @Param('platform', { schema: accountPlatformSchema }) platform: AccountPlatform,
  ): Promise<void> {
    await this.disconnectAccountUseCase.execute(brandId, platform);
  }
}
