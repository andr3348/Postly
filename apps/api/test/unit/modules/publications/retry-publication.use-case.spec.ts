import {
  ForbiddenError,
  PublicationRetryNotAllowedError,
  RetryLimitExceededError,
  UnsupportedRetryPlatformError,
} from '../../../../src/shared/errors.js';
import { RetryPublicationUseCase } from '../../../../src/modules/publications/application/retry-publication.use-case.js';
import type {
  RetryablePlatform,
  TargetFailure,
} from '../../../../src/modules/publications/domain/target.entity.js';
import { classifyTargetFailure } from '../../../../src/modules/publications/domain/target-failure.js';
import {
  ADMIN,
  BASE_PUBLICATION,
  BASE_TARGET,
  MARKETING,
} from './test-stubs.js';
import { stubPublicationUnitOfWork } from '../dispatch/test-stubs.js';

const RETRYABLE_FAILURE = classifyTargetFailure({
  stage: 'PUBLISH',
  errorMessage: '400 - {"error":{"message":"rate limit","code":4,"fbtrace_id":"t-1"}}',
});
const NON_RETRYABLE_FAILURE = classifyTargetFailure({
  stage: 'PUBLISH',
  errorMessage: '500 - timeout',
});

const PARTIAL = {
  ...BASE_PUBLICATION,
  status: 'PARTIAL' as const,
  approvedById: 'admin-1',
  approvedAt: new Date('2026-01-01T00:00:00Z'),
  dispatchAttemptId: 'attempt-old',
};

function target(
  platform: 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN',
  status: 'SUCCESS' | 'FAILED',
  overrides: {
    id?: string;
    failure?: TargetFailure | null;
    retryCount?: number;
    externalPostId?: string | null;
  } = {},
) {
  return {
    ...BASE_TARGET,
    id: overrides.id ?? `target-${platform.toLowerCase()}`,
    platform,
    status,
    externalPostId: overrides.externalPostId ?? (status === 'SUCCESS' ? `post-${platform}` : null),
    errorMessage: status === 'FAILED' ? 'failed' : null,
    failure: overrides.failure ?? (status === 'FAILED' ? RETRYABLE_FAILURE : null),
    retryCount: overrides.retryCount ?? 0,
    publishedAt: status === 'SUCCESS' ? new Date('2026-01-01T00:00:00Z') : null,
  };
}

describe('RetryPublicationUseCase', () => {
  function arrange(targets: ReturnType<typeof target>[]) {
    const { uow, state } = stubPublicationUnitOfWork({
      publication: PARTIAL,
      targets,
    });
    let notified = 0;
    const useCase = new RetryPublicationUseCase(uow, {
      notify: async () => {
        notified += 1;
      },
    });
    return { useCase, state, notified: () => notified };
  }

  it('retries only the selected failed Meta target without touching successes', async () => {
    const facebook = target('FACEBOOK', 'FAILED');
    const instagram = target('INSTAGRAM', 'SUCCESS');
    const { useCase, state, notified } = arrange([facebook, instagram]);

    const publication = await useCase.execute({
      id: PARTIAL.id,
      platforms: ['FACEBOOK'],
      requester: ADMIN,
    });

    expect(publication.status).toBe('SCHEDULED');
    expect(publication.dispatchAttemptId).toBeNull();
    expect(publication.scheduledAt).toBeInstanceOf(Date);
    expect(state.targets.find((item) => item.id === facebook.id)).toMatchObject({
      status: 'PENDING',
      retryCount: 1,
      failure: null,
      errorMessage: null,
    });
    expect(state.targets.find((item) => item.id === instagram.id)).toMatchObject({
      status: 'SUCCESS',
      externalPostId: 'post-INSTAGRAM',
      retryCount: 0,
    });
    expect(notified()).toBe(1);
  });

  it('does not retry successful targets', async () => {
    const { useCase } = arrange([
      target('FACEBOOK', 'SUCCESS'),
      target('INSTAGRAM', 'FAILED'),
    ]);

    await expect(
      useCase.execute({ id: PARTIAL.id, platforms: ['FACEBOOK'], requester: ADMIN }),
    ).rejects.toBeInstanceOf(PublicationRetryNotAllowedError);
  });

  it('rejects non-admin users', async () => {
    const { useCase } = arrange([target('FACEBOOK', 'FAILED')]);

    await expect(
      useCase.execute({ id: PARTIAL.id, platforms: ['FACEBOOK'], requester: MARKETING }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects publications that are not PARTIAL or FAILED', async () => {
    const scheduled = { ...PARTIAL, status: 'SCHEDULED' as const };
    const { uow } = stubPublicationUnitOfWork({
      publication: scheduled,
      targets: [target('FACEBOOK', 'FAILED')],
    });
    const nonTerminal = new RetryPublicationUseCase(uow, { notify: async () => {} });

    await expect(
      nonTerminal.execute({ id: PARTIAL.id, platforms: ['FACEBOOK'], requester: ADMIN }),
    ).rejects.toBeInstanceOf(PublicationRetryNotAllowedError);
  });

  it('rejects unsafe failures such as an unknown outcome', async () => {
    const { useCase } = arrange([
      target('INSTAGRAM', 'FAILED', { failure: NON_RETRYABLE_FAILURE }),
    ]);

    await expect(
      useCase.execute({ id: PARTIAL.id, platforms: ['INSTAGRAM'], requester: ADMIN }),
    ).rejects.toBeInstanceOf(PublicationRetryNotAllowedError);
  });

  it('enforces the three manual attempts per target', async () => {
    const { useCase } = arrange([target('FACEBOOK', 'FAILED', { retryCount: 3 })]);

    await expect(
      useCase.execute({ id: PARTIAL.id, platforms: ['FACEBOOK'], requester: ADMIN }),
    ).rejects.toBeInstanceOf(RetryLimitExceededError);
  });

  it('rejects platforms outside Facebook and Instagram', async () => {
    const { useCase } = arrange([target('LINKEDIN', 'FAILED')]);

    await expect(
      useCase.execute({
        id: PARTIAL.id,
        platforms: ['LINKEDIN' as RetryablePlatform],
        requester: ADMIN,
      }),
    ).rejects.toBeInstanceOf(UnsupportedRetryPlatformError);
  });
});
