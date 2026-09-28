import { Inject, Injectable } from '@nestjs/common';
import type { Platform } from '@postly/database';
import { CONNECTED_ACCOUNTS_REPOSITORY, type ConnectedAccountsRepository } from '../domain/ports/connected-accounts.repository.js';
import type { ConnectedAccountWithCredentials } from '../domain/connected-account.entity.js';
import { MissingConnectedAccountError } from '../../../shared/errors.js';

@Injectable()
export class GetCredentialsUseCase {
  constructor(
    @Inject(CONNECTED_ACCOUNTS_REPOSITORY)
    private readonly accountsRepository: ConnectedAccountsRepository,
  ) {}

  async execute(brandId: string, platforms: Platform[]): Promise<ConnectedAccountWithCredentials[]> {
    const credentials = await this.accountsRepository.getCredentialsForDispatch(brandId, platforms);
    
    const foundPlatforms = new Set(credentials.map(c => c.platform));
    const missingPlatforms = platforms.filter(p => !foundPlatforms.has(p));
    
    if (missingPlatforms.length > 0) {
      throw new MissingConnectedAccountError(brandId, missingPlatforms);
    }

    return credentials;
  }
}
