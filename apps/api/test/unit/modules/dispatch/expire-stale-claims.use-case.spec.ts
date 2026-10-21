import { ExpireStaleClaimsUseCase } from '../../../../src/modules/dispatch/application/expire-stale-claims.use-case.js';
import type { PublicationTarget } from '../../../../src/modules/publications/domain/target.entity.js';
import {
  BASE_PUBLICATION,
  BASE_TARGET,
  stubPublicationUnitOfWork,
  stubPublicationsRepository,
} from './test-stubs.js';

/** Espejo del lease del caso de uso (15 min): el corte llega al puerto. */
const LEASE_TIMEOUT_MS = 15 * 60_000;

describe('ExpireStaleClaimsUseCase', () => {
  const now = new Date('2026-01-01T01:00:00Z');
  const stale = {
    ...BASE_PUBLICATION,
    status: 'PROCESSING' as const,
    dispatchedAt: new Date('2026-01-01T00:00:00Z'),
    dispatchAttemptId: 'attempt-1',
  };

  function arrange(
    options: { stale?: (typeof stale)[]; targetStatuses?: PublicationTarget['status'][] } = {},
  ) {
    const initialTargets: PublicationTarget[] = (options.targetStatuses ?? ['PENDING']).map(
      (status, index) => ({ ...BASE_TARGET, id: `target-${index + 1}`, status }),
    );
    const cutoffs: Date[] = [];
    const publications = stubPublicationsRepository({
      findStaleProcessing: async (olderThan) => {
        cutoffs.push(olderThan);
        return options.stale ?? [stale];
      },
    });
    const { uow, state } = stubPublicationUnitOfWork({
      publication: stale,
      targets: initialTargets,
    });
    return {
      useCase: new ExpireStaleClaimsUseCase(publications, uow),
      cutoffs,
      state,
    };
  }

  it('requeues the publication when n8n reported nothing', async () => {
    const { useCase, cutoffs, state } = arrange();

    await expect(useCase.execute(now)).resolves.toBe(1);

    expect(cutoffs).toEqual([new Date(now.getTime() - LEASE_TIMEOUT_MS)]);
    expect(state.publication).toMatchObject({
      status: 'SCHEDULED',
      dispatchedAt: null,
      dispatchAttemptId: null,
    });
    expect(state.targetUpdates).toEqual([]);
    expect(state.targets[0]).toMatchObject({ status: 'PENDING', errorMessage: null });
  });

  it('closes as FAILED when only failures were reported', async () => {
    const { useCase, state } = arrange({
      targetStatuses: ['FAILED', 'PENDING'],
    });

    await useCase.execute(now);

    expect(state.targets.map((target) => target.status)).toEqual(['FAILED', 'FAILED']);
    expect(state.targets[1]?.errorMessage).toContain('Despacho vencido');
    expect(state.targets[1]?.failure).toMatchObject({
      kind: 'UNKNOWN_OUTCOME',
      retryable: false,
    });
    expect(state.publication).toMatchObject({
      status: 'FAILED',
      dispatchAttemptId: null,
    });
  });

  it('keeps already reported successes and closes as PARTIAL', async () => {
    const { useCase, state } = arrange({
      targetStatuses: ['SUCCESS', 'PENDING'],
    });

    await useCase.execute(now);

    expect(state.targets.map((target) => target.status)).toEqual(['SUCCESS', 'FAILED']);
    expect(state.targets[0]?.errorMessage).toBeNull();
    expect(state.publication).toMatchObject({ status: 'PARTIAL', dispatchAttemptId: null });
  });

  it('does nothing when there are no stale claims', async () => {
    const { useCase, state } = arrange({ stale: [] });

    await expect(useCase.execute(now)).resolves.toBe(0);
    expect(state.publicationUpdates).toEqual([]);
  });
});
