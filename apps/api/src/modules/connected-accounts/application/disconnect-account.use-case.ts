import { Inject, Injectable } from '@nestjs/common';
import type { Platform } from '@postly/database';
import { CONNECTED_ACCOUNTS_REPOSITORY, type ConnectedAccountsRepository } from '../domain/ports/connected-accounts.repository.js';
import { BRANDS_REPOSITORY, type BrandsRepository } from '../../brand/domain/ports/brands.repository.js';
import { BrandNotFoundError } from '../../../shared/errors.js';

@Injectable()
export class DisconnectAccountUseCase {
  constructor(
    @Inject(CONNECTED_ACCOUNTS_REPOSITORY)
    private readonly accountsRepository: ConnectedAccountsRepository,
    @Inject(BRANDS_REPOSITORY)
    private readonly brandsRepository: BrandsRepository,
  ) {}

  async execute(brandId: string, platform: Platform): Promise<void> {
    const brand = await this.brandsRepository.findById(brandId);
    if (!brand) {
      throw new BrandNotFoundError(brandId);
    }
    return this.accountsRepository.disconnectAccount(brandId, platform);
  }
}
