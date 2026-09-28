import { Inject, Injectable } from '@nestjs/common';
import { CONNECTED_ACCOUNTS_REPOSITORY, type ConnectedAccountsRepository } from '../domain/ports/connected-accounts.repository.js';
import { BRANDS_REPOSITORY, type BrandsRepository } from '../../brand/domain/ports/brands.repository.js';
import type { ConnectedAccount } from '../domain/connected-account.entity.js';
import { BrandNotFoundError } from '../../../shared/errors.js';

@Injectable()
export class GetAccountsUseCase {
  constructor(
    @Inject(CONNECTED_ACCOUNTS_REPOSITORY)
    private readonly accountsRepository: ConnectedAccountsRepository,
    @Inject(BRANDS_REPOSITORY)
    private readonly brandsRepository: BrandsRepository,
  ) {}

  async execute(brandId: string): Promise<ConnectedAccount[]> {
    const brand = await this.brandsRepository.findById(brandId);
    if (!brand) {
      throw new BrandNotFoundError(brandId);
    }
    return this.accountsRepository.findAllByBrand(brandId);
  }
}
