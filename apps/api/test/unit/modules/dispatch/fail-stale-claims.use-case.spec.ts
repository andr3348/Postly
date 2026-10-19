import { FailStaleClaimsUseCase } from '../../../../src/modules/dispatch/application/fail-stale-claims.use-case.js';
import type { PublicationTarget } from '../../../../src/modules/publications/domain/target.entity.js';
import {
  BASE_PUBLICATION,
  BASE_TARGET,
  stubPublicationTargetsRepository,
  stubPublicationsRepository,
} from './test-stubs.js';

/** Espejo del lease del caso de uso (15 min): el corte llega al puerto. */
const LEASE_TIMEOUT_MS = 15 * 60_000;

describe('FailStaleClaimsUseCase', () => {
  const now = new Date('2026-01-01T01:00:00Z');
  const stale = {
    ...BASE_PUBLICATION,
    status: 'PROCESSING' as const,
    dispatchedAt: new Date('2026-01-01T00:00:00Z'),
  };

  function arrange(
    options: { stale?: (typeof stale)[]; targetStatuses?: PublicationTarget['status'][] } = {},
  ) {
    let targetsState: PublicationTarget[] = (options.targetStatuses ?? ['PENDING']).map(
      (status, index) => ({ ...BASE_TARGET, id: `target-${index + 1}`, status }),
    );
    const cutoffs: Date[] = [];
    const updatedPublications: Array<{ id: string; status?: string }> = [];
    const publications = stubPublicationsRepository({
      findStaleProcessing: async (olderThan) => {
        cutoffs.push(olderThan);
        return options.stale ?? [stale];
      },
      update: async (id, data) => {
        updatedPublications.push({ id, status: data.status });
        return { ...stale, id, ...data };
      },
    });
    const targets = stubPublicationTargetsRepository({
      findByPublication: async () => targetsState,
      updateTarget: async (id, data) => {
        const current = targetsState.find((target) => target.id === id) ?? BASE_TARGET;
        const updated = { ...current, ...data };
        targetsState = targetsState.map((target) => (target.id === id ? updated : target));
        return updated;
      },
    });
    return {
      useCase: new FailStaleClaimsUseCase(publications, targets),
      cutoffs,
      updatedPublications,
      targetsState: () => targetsState,
    };
  }

  it('fails unreported targets and closes the publication as FAILED', async () => {
    const { useCase, cutoffs, updatedPublications, targetsState } = arrange();

    await expect(useCase.execute(now)).resolves.toBe(1);

    expect(cutoffs).toEqual([new Date(now.getTime() - LEASE_TIMEOUT_MS)]);
    expect(targetsState()[0]).toMatchObject({ status: 'FAILED' });
    expect(targetsState()[0]?.errorMessage).toContain('Despacho vencido');
    expect(updatedPublications).toEqual([{ id: BASE_PUBLICATION.id, status: 'FAILED' }]);
  });

  it('keeps already reported targets and closes as PARTIAL', async () => {
    const { useCase, updatedPublications, targetsState } = arrange({
      targetStatuses: ['SUCCESS', 'PENDING'],
    });

    await useCase.execute(now);

    expect(targetsState().map((target) => target.status)).toEqual(['SUCCESS', 'FAILED']);
    expect(targetsState()[0]?.errorMessage).toBeNull();
    expect(updatedPublications).toEqual([{ id: BASE_PUBLICATION.id, status: 'PARTIAL' }]);
  });

  it('does nothing when there are no stale claims', async () => {
    const { useCase, updatedPublications } = arrange({ stale: [] });

    await expect(useCase.execute(now)).resolves.toBe(0);
    expect(updatedPublications).toEqual([]);
  });
});
