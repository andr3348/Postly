import { Inject, Injectable } from '@nestjs/common';
import { CONNECTED_ACCOUNTS_REPOSITORY, type ConnectedAccountsRepository } from '../domain/ports/connected-accounts.repository.js';
import { BRANDS_REPOSITORY, type BrandsRepository } from '../../brand/domain/ports/brands.repository.js';
import type { AccountPlatform } from '../domain/connected-account.entity.js';
import { BrandNotFoundError, ConnectedAccountNotFoundError } from '../../../shared/errors.js';

@Injectable()
export class DisconnectAccountUseCase {
  constructor(
    @Inject(CONNECTED_ACCOUNTS_REPOSITORY)
    private readonly accountsRepository: ConnectedAccountsRepository,
    @Inject(BRANDS_REPOSITORY)
    private readonly brandsRepository: BrandsRepository,
  ) {}

  async execute(brandId: string, platform: AccountPlatform): Promise<void> {
    const brand = await this.brandsRepository.findById(brandId);
    if (brand === null) {
      throw new BrandNotFoundError(brandId);
    }
    const disconnected = await this.accountsRepository.disconnectAccount(brandId, platform);
    if (!disconnected) {
      throw new ConnectedAccountNotFoundError(brandId, platform);
    }
  }
}
