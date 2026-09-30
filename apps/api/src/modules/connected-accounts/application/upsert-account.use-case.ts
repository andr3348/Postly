import { Inject, Injectable } from '@nestjs/common';
import { CONNECTED_ACCOUNTS_REPOSITORY, type ConnectedAccountsRepository } from '../domain/ports/connected-accounts.repository.js';
import { BRANDS_REPOSITORY, type BrandsRepository } from '../../brand/domain/ports/brands.repository.js';
import type { AccountPlatform, ConnectedAccount } from '../domain/connected-account.entity.js';
import { BrandNotFoundError } from '../../../shared/errors.js';

export interface UpsertAccountInput {
  readonly brandId: string;
  readonly platform: AccountPlatform;
  readonly accountName: string;
  readonly externalAccountId: string;
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: Date;
  readonly scope?: string;
}

@Injectable()
export class UpsertAccountUseCase {
  constructor(
    @Inject(CONNECTED_ACCOUNTS_REPOSITORY)
    private readonly accountsRepository: ConnectedAccountsRepository,
    @Inject(BRANDS_REPOSITORY)
    private readonly brandsRepository: BrandsRepository,
  ) {}

  async execute(input: UpsertAccountInput): Promise<ConnectedAccount> {
    const brand = await this.brandsRepository.findById(input.brandId);
    if (brand === null) {
      throw new BrandNotFoundError(input.brandId);
    }
    // Un token ya vencido nace EXPIRED: la UI debe pedir re-autenticar.
    const status =
      input.expiresAt !== undefined && input.expiresAt.getTime() <= Date.now()
        ? 'EXPIRED'
        : 'CONNECTED';
    return this.accountsRepository.upsertAccount(input.brandId, { ...input, status });
  }
}
