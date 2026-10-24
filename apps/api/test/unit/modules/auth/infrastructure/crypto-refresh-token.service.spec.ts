import { CryptoRefreshTokenService } from '../../../../../src/modules/auth/infrastructure/crypto-refresh-token.service.js';

const OPTIONS = {
  accessSecret: 'test-access-secret-32-chars-min!!',
  accessExpiresInSeconds: 900,
  refreshExpiresInSeconds: 604_800,
};

describe('CryptoRefreshTokenService', () => {
  const service = new CryptoRefreshTokenService(OPTIONS);

  it('issues a high-entropy token whose stored hash matches', () => {
    const before = Date.now();
    const first = service.issue();
    const second = service.issue();

    expect(first.token).not.toBe(second.token);
    expect(first.token).toHaveLength(64);
    expect(first.hash).toBe(service.hash(first.token));
    expect(first.hash).toHaveLength(64);
    expect(first.hash).not.toContain(first.token);
    expect(first.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + OPTIONS.refreshExpiresInSeconds * 1000,
    );
  });

  it('hashes deterministically', () => {
    expect(service.hash('token')).toBe(service.hash('token'));
    expect(service.hash('token')).not.toBe(service.hash('otro'));
  });
});
