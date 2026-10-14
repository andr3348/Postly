import { Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNT_VERIFIER,
  type AccountVerifier,
  type VerifiedAccountInfo,
  type VerifyAccountInput,
} from '../domain/ports/account-verifier.port.js';
import { BRANDS_REPOSITORY, type BrandsRepository } from '../../brand/domain/ports/brands.repository.js';
import { BrandNotFoundError } from '../../../shared/errors.js';

export interface VerifyAccountResult extends VerifiedAccountInfo {
  readonly valid: true;
}

/**
 * Verifica un token contra la API real del proveedor sin persistir nada.
 * La UI lo llama desde el modal antes del upsert para no guardar basura.
 */
@Injectable()
export class VerifyAccountUseCase {
  constructor(
    @Inject(ACCOUNT_VERIFIER)
    private readonly verifier: AccountVerifier,
    @Inject(BRANDS_REPOSITORY)
    private readonly brandsRepository: BrandsRepository,
  ) {}

  async execute(
    brandId: string,
    input: VerifyAccountInput,
  ): Promise<VerifyAccountResult> {
    const brand = await this.brandsRepository.findById(brandId);
    if (brand === null) {
      throw new BrandNotFoundError(brandId);
    }
    const info = await this.verifier.verify(input);
    return { valid: true, ...info };
  }
}
