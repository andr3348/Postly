import { Controller, Post, Get, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { UpsertAccountUseCase } from '../application/upsert-account.use-case.js';
import { GetAccountsUseCase } from '../application/get-accounts.use-case.js';
import { DisconnectAccountUseCase } from '../application/disconnect-account.use-case.js';
import { connectAccountSchema, type ConnectAccountDto } from './schemas/connect-account.schema.js';
import type { Platform } from '@postly/database';

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
    return this.upsertAccountUseCase.execute(brandId, dto);
  }

  @Get()
  async findAllByBrand(@Param('brandId') brandId: string) {
    return this.getAccountsUseCase.execute(brandId);
  }

  @Delete(':platform')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnectAccount(
    @Param('brandId') brandId: string,
    @Param('platform') platform: Platform,
  ) {
    await this.disconnectAccountUseCase.execute(brandId, platform);
  }
}
