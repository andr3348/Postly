import type { ConnectedAccountWithCredentials } from '../../../../src/modules/connected-accounts/domain/connected-account.entity.js';
import type { DispatchCredentials } from '../../../../src/modules/dispatch/domain/ports/dispatch-credentials.port.js';
import type { MetricSnapshot, TargetMetric } from '../../../../src/modules/publications/domain/metric.entity.js';
import type { Publication } from '../../../../src/modules/publications/domain/publication.entity.js';
import type { PublicationMetricsRepository } from '../../../../src/modules/publications/domain/ports/publication-metrics.repository.js';
import type { PublicationsRepository } from '../../../../src/modules/publications/domain/ports/publications.repository.js';
import type { PublicationTargetsRepository } from '../../../../src/modules/publications/domain/ports/publication-targets.repository.js';
import type {
  PublicationTransaction,
  PublicationUnitOfWork,
} from '../../../../src/modules/publications/domain/ports/publication-unit-of-work.port.js';
import type { UpdatePublicationData } from '../../../../src/modules/publications/domain/ports/publications.repository.js';
import type { PublicationTarget } from '../../../../src/modules/publications/domain/target.entity.js';

const BASE_PUBLICATION: Publication = {
  id: 'pub-1',
  brandId: 'brand-1',
  userId: 'user-1',
  approvedById: 'admin-1',
  approvedAt: new Date('2026-01-01T00:00:00Z'),
  originalPrompt: 'prompt',
  systemPrompt: null,
  modelText: 'manual',
  modelMedia: null,
  tokensUsed: null,
  copy: 'copy',
  mediaUrl: 'https://postly.test/m.jpg',
  mediaType: 'IMAGE',
  status: 'SCHEDULED',
  scheduledAt: new Date('2026-01-01T00:00:00Z'),
  dispatchedAt: null,
  dispatchAttemptId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const BASE_TARGET: PublicationTarget = {
  id: 'target-1',
  publicationId: BASE_PUBLICATION.id,
  platform: 'LINKEDIN',
  format: 'FEED',
  status: 'PENDING',
  externalPostId: null,
  externalPostUrl: null,
  errorMessage: null,
  failure: null,
  retryCount: 0,
  publishedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const BASE_CREDENTIALS: ConnectedAccountWithCredentials = {
  id: 'account-1',
  brandId: BASE_PUBLICATION.brandId,
  platform: 'LINKEDIN',
  status: 'CONNECTED',
  accountName: 'almaquintaoficial',
  externalAccountId: 'urn:li:org:1',
  accessToken: 'decrypted-access',
  refreshToken: null,
  expiresAt: null,
  scope: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

export function stubPublicationsRepository(
  overrides: Partial<PublicationsRepository> = {},
): PublicationsRepository {
  return {
    findById: async () => null,
    findMany: async () => [],
    create: async (data) => ({ ...BASE_PUBLICATION, ...data, status: 'DRAFT' as const }),
    update: async (id, data) => ({ ...BASE_PUBLICATION, id, ...data }),
    findDueDispatch: async () => [],
    markProcessing: async () => true,
    findStaleProcessing: async () => [],
    ...overrides,
  };
}

export function stubPublicationTargetsRepository(
  overrides: Partial<PublicationTargetsRepository> = {},
): PublicationTargetsRepository {
  return {
    findById: async () => null,
    findByPublication: async () => [],
    add: async (publicationId, platform, format) => ({
      ...BASE_TARGET,
      publicationId,
      platform,
      format,
    }),
    updateFormat: async (id, format) => ({ ...BASE_TARGET, id, format }),
    remove: async () => true,
    updateTarget: async (id, data) => ({ ...BASE_TARGET, id, ...data }),
    ...overrides,
  };
}

export function stubPublicationMetricsRepository(
  overrides: Partial<PublicationMetricsRepository> = {},
): PublicationMetricsRepository {
  return {
    record: async (targetId, snapshot) => ({
      id: 'metric-1',
      publicationTargetId: targetId,
      impressions: snapshot.impressions ?? 0,
      likes: snapshot.likes ?? 0,
      comments: snapshot.comments ?? 0,
      shares: snapshot.shares ?? 0,
      clicks: snapshot.clicks ?? 0,
      capturedAt: new Date('2026-01-02T00:00:00Z'),
    }),
    history: async () => [],
    ...overrides,
  };
}

export function stubDispatchCredentials(
  overrides: Partial<DispatchCredentials> = {},
): DispatchCredentials {
  return {
    getForDispatch: async () => [BASE_CREDENTIALS],
    ...overrides,
  };
}

interface UnitOfWorkState {
  publication: Publication | null;
  targets: PublicationTarget[];
  publicationUpdates: UpdatePublicationData[];
  targetUpdates: Array<{ id: string; data: Record<string, unknown> }>;
  metrics: Array<{ targetId: string; snapshot: MetricSnapshot }>;
  recordedMetrics: TargetMetric[];
}

/** Unit of work en memoria para probar la orquestación transaccional. */
export function stubPublicationUnitOfWork(initial: {
  publication?: Publication | null;
  targets?: PublicationTarget[];
} = {}): { uow: PublicationUnitOfWork; state: UnitOfWorkState } {
  const state: UnitOfWorkState = {
    publication: initial.publication ?? null,
    targets: [...(initial.targets ?? [])],
    publicationUpdates: [],
    targetUpdates: [],
    metrics: [],
    recordedMetrics: [],
  };

  const tx: PublicationTransaction = {
    lockPublication: async () => state.publication,
    findPublication: async () => state.publication,
    findTarget: async (id) => state.targets.find((target) => target.id === id) ?? null,
    findTargets: async (publicationId) =>
      state.targets.filter((target) => target.publicationId === publicationId),
    updateTarget: async (id, data) => {
      const current = state.targets.find((target) => target.id === id);
      if (current === undefined) {
        throw new Error(`Target not found in stub: ${id}`);
      }
      state.targetUpdates.push({ id, data: { ...data } });
      const updated = { ...current, ...data };
      state.targets = state.targets.map((target) => (target.id === id ? updated : target));
      return updated;
    },
    updatePublication: async (id, data) => {
      if (state.publication === null) {
        throw new Error(`Publication not found in stub: ${id}`);
      }
      state.publicationUpdates.push(data);
      state.publication = { ...state.publication, ...data, id };
      return state.publication;
    },
    recordMetric: async (targetId, snapshot) => {
      state.metrics.push({ targetId, snapshot });
      const metric: TargetMetric = {
        id: `metric-${state.metrics.length}`,
        publicationTargetId: targetId,
        impressions: snapshot.impressions ?? 0,
        likes: snapshot.likes ?? 0,
        comments: snapshot.comments ?? 0,
        shares: snapshot.shares ?? 0,
        clicks: snapshot.clicks ?? 0,
        capturedAt: new Date('2026-01-02T00:00:00Z'),
      };
      state.recordedMetrics.push(metric);
      return metric;
    },
  };

  return {
    uow: {
      run: async (work) => work(tx),
    },
    state,
  };
}

export { BASE_CREDENTIALS, BASE_PUBLICATION, BASE_TARGET };
