import {
  InvalidTargetReportError,
  PublicationTargetNotFoundError,
  StaleDispatchAttemptError,
} from '../../../../src/shared/errors.js';
import { ReportTargetUseCase } from '../../../../src/modules/dispatch/application/report-target.use-case.js';
import {
  BASE_PUBLICATION,
  BASE_TARGET,
  stubPublicationUnitOfWork,
} from './test-stubs.js';

const PROCESSING = {
  ...BASE_PUBLICATION,
  status: 'PROCESSING' as const,
  dispatchedAt: new Date('2026-01-01T00:00:00Z'),
  dispatchAttemptId: 'attempt-1',
};

const SUCCESS_TARGET = {
  ...BASE_TARGET,
  id: 'target-success',
  status: 'SUCCESS' as const,
  externalPostId: 'post-1',
  publishedAt: new Date('2026-01-01T00:00:00Z'),
};
const FAILED_TARGET = {
  ...BASE_TARGET,
  id: 'target-failed',
  status: 'FAILED' as const,
  errorMessage: 'previous failure',
};

describe('ReportTargetUseCase', () => {
  function arrange(targets = [BASE_TARGET]) {
    return stubPublicationUnitOfWork({ publication: PROCESSING, targets });
  }

  const report = (targetId = BASE_TARGET.id) => ({
    targetId,
    dispatchAttemptId: 'attempt-1',
    status: 'SUCCESS' as const,
    externalPostId: 'post-1',
  });

  it('marks PUBLISHED when all targets succeed', async () => {
    const { uow, state } = arrange();
    const useCase = new ReportTargetUseCase(uow);

    const output = await useCase.execute(report());

    expect(output.terminal).toBe(true);
    expect(output.publication.status).toBe('PUBLISHED');
    expect(state.publication?.status).toBe('PUBLISHED');
    expect(state.targets[0]?.status).toBe('SUCCESS');
    expect(state.targets[0]?.externalPostId).toBe('post-1');
  });

  it('marks PARTIAL on mixed results and FAILED when all fail', async () => {
    const partialState = arrange([BASE_TARGET, FAILED_TARGET]);
    const partial = await new ReportTargetUseCase(partialState.uow).execute(report());
    expect(partial.publication.status).toBe('PARTIAL');
    expect(partial.terminal).toBe(true);

    const failedState = arrange([BASE_TARGET, FAILED_TARGET]);
    const failed = await new ReportTargetUseCase(failedState.uow).execute({
      targetId: BASE_TARGET.id,
      dispatchAttemptId: 'attempt-1',
      status: 'FAILED',
      stage: 'PUBLISH',
      errorMessage: '400 - {"error":{"message":"rate limit","code":4}}',
    });
    expect(failed.publication.status).toBe('FAILED');
    expect(failed.terminal).toBe(true);
  });

  it('leaves PROCESSING while targets remain pending', async () => {
    const secondPending = { ...BASE_TARGET, id: 'target-2' };
    const { uow, state } = arrange([BASE_TARGET, secondPending]);

    const output = await new ReportTargetUseCase(uow).execute(report());

    expect(output.terminal).toBe(false);
    expect(output.publication.status).toBe('PROCESSING');
    expect(state.publicationUpdates).toHaveLength(0);
  });

  it('records metrics inside the transaction when provided', async () => {
    const { uow, state } = arrange();

    await new ReportTargetUseCase(uow).execute({
      ...report(),
      metrics: { impressions: 50 },
    });

    expect(state.metrics).toEqual([
      { targetId: BASE_TARGET.id, snapshot: { impressions: 50 } },
    ]);
    expect(state.recordedMetrics).toHaveLength(1);
  });

  it('classifies and persists a retryable Meta failure', async () => {
    const { uow, state } = arrange();

    await new ReportTargetUseCase(uow).execute({
      targetId: BASE_TARGET.id,
      dispatchAttemptId: 'attempt-1',
      status: 'FAILED',
      stage: 'PUBLISH',
      errorMessage:
        '400 - {"error":{"message":"Please reduce the amount of data","type":"OAuthException","code":4,"fbtrace_id":"trace-1"}}',
    });

    expect(state.targets[0]?.failure).toMatchObject({
      kind: 'RATE_LIMIT',
      retryable: true,
      code: 4,
      httpStatus: 400,
      traceId: 'trace-1',
    });
  });

  it('rejects a success without externalPostId', async () => {
    const { uow } = arrange();

    await expect(
      new ReportTargetUseCase(uow).execute({
        targetId: BASE_TARGET.id,
        dispatchAttemptId: 'attempt-1',
        status: 'SUCCESS',
      }),
    ).rejects.toBeInstanceOf(InvalidTargetReportError);
  });

  it('rejects a failure without stage', async () => {
    const { uow } = arrange();

    await expect(
      new ReportTargetUseCase(uow).execute({
        targetId: BASE_TARGET.id,
        dispatchAttemptId: 'attempt-1',
        status: 'FAILED',
        errorMessage: 'boom',
      }),
    ).rejects.toBeInstanceOf(InvalidTargetReportError);
  });

  it('rejects a report from a previous dispatch attempt', async () => {
    const { uow, state } = arrange();

    await expect(
      new ReportTargetUseCase(uow).execute({
        ...report(),
        dispatchAttemptId: 'attempt-old',
      }),
    ).rejects.toBeInstanceOf(StaleDispatchAttemptError);
    expect(state.targets[0]?.status).toBe('PENDING');
  });

  it('is idempotent for a duplicate report with the same status', async () => {
    const { uow, state } = arrange([SUCCESS_TARGET]);

    const output = await new ReportTargetUseCase(uow).execute(report(SUCCESS_TARGET.id));

    expect(output.terminal).toBe(false);
    expect(state.targets[0]?.status).toBe('SUCCESS');
  });

  it('throws PublicationTargetNotFoundError for an unknown target', async () => {
    const { uow } = arrange([]);

    await expect(
      new ReportTargetUseCase(uow).execute({
        targetId: 'missing',
        dispatchAttemptId: 'attempt-1',
        status: 'FAILED',
        stage: 'PUBLISH',
        errorMessage: 'boom',
      }),
    ).rejects.toBeInstanceOf(PublicationTargetNotFoundError);
  });
});
