import { PublicationTargetNotFoundError } from '../../../../src/shared/errors.js';
import { ReportTargetUseCase } from '../../../../src/modules/dispatch/application/report-target.use-case.js';
import {
  BASE_PUBLICATION,
  BASE_TARGET,
  stubPublicationMetricsRepository,
  stubPublicationTargetsRepository,
  stubPublicationsRepository,
} from './test-stubs.js';

const SUCCESS_TARGET = { ...BASE_TARGET, status: 'SUCCESS' as const };
const FAILED_TARGET = { ...BASE_TARGET, id: 'target-2', status: 'FAILED' as const };

describe('ReportTargetUseCase', () => {
  function arrange(targets: typeof BASE_TARGET[]) {
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
    });
    const targetsRepo = stubPublicationTargetsRepository({
      findByPublication: async () => targets,
      findById: async (id) => targets.find((target) => target.id === id) ?? null,
    });
    return new ReportTargetUseCase(
      publications,
      targetsRepo,
      stubPublicationMetricsRepository(),
    );
  }

  it('marks PUBLISHED when all targets succeed', async () => {
    const updated: string[] = [];
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
      update: async (id, data) => {
        updated.push(JSON.stringify(data));
        return { ...BASE_PUBLICATION, id, ...data };
      },
    });
    const targets = stubPublicationTargetsRepository({
      findByPublication: async () => [SUCCESS_TARGET],
      findById: async () => ({ ...BASE_TARGET, status: 'PENDING' as const }),
    });
    const useCase = new ReportTargetUseCase(
      publications,
      targets,
      stubPublicationMetricsRepository(),
    );

    const output = await useCase.execute({ targetId: 'target-1', status: 'SUCCESS' });

    expect(output.terminal).toBe(true);
    expect(output.publication.status).toBe('PUBLISHED');
    expect(updated).toHaveLength(1);
  });

  it('marks PARTIAL on mixed results and FAILED when all fail', async () => {
    const arrangeMixed = (siblings: typeof BASE_TARGET[]) =>
      arrange(siblings).execute({ targetId: 'target-1', status: 'SUCCESS' });

    const partial = await arrangeMixed([SUCCESS_TARGET, FAILED_TARGET]);
    expect(partial.publication.status).toBe('PARTIAL');
    expect(partial.terminal).toBe(true);

    const failed = await arrangeMixed([{ ...FAILED_TARGET, id: 'target-1' }]);
    expect(failed.publication.status).toBe('FAILED');
  });

  it('leaves PROCESSING while targets remain pending', async () => {
    const updated: string[] = [];
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
      update: async (id, data) => {
        updated.push(JSON.stringify(data));
        return { ...BASE_PUBLICATION, id, ...data };
      },
    });
    const targets = stubPublicationTargetsRepository({
      findByPublication: async () => [SUCCESS_TARGET, BASE_TARGET],
      findById: async () => BASE_TARGET,
    });
    const useCase = new ReportTargetUseCase(
      publications,
      targets,
      stubPublicationMetricsRepository(),
    );

    const output = await useCase.execute({ targetId: 'target-1', status: 'SUCCESS' });

    expect(output.terminal).toBe(false);
    expect(updated).toHaveLength(0);
  });

  it('records metrics when provided', async () => {
    const recorded: unknown[] = [];
    const metrics = stubPublicationMetricsRepository({
      record: async (targetId, snapshot) => {
        recorded.push({ targetId, snapshot });
        return {
          id: 'metric-1',
          publicationTargetId: targetId,
          impressions: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0,
          capturedAt: new Date(),
        };
      },
    });
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
    });
    const targets = stubPublicationTargetsRepository({
      findByPublication: async () => [SUCCESS_TARGET],
      findById: async () => BASE_TARGET,
    });
    const useCase = new ReportTargetUseCase(publications, targets, metrics);

    await useCase.execute({
      targetId: 'target-1',
      status: 'SUCCESS',
      metrics: { impressions: 50 },
    });

    expect(recorded).toHaveLength(1);
  });

  it('throws PublicationTargetNotFoundError for an unknown target', async () => {
    const publications = stubPublicationsRepository({
      findById: async () => BASE_PUBLICATION,
    });

    await expect(
      new ReportTargetUseCase(
        publications,
        stubPublicationTargetsRepository(),
        stubPublicationMetricsRepository(),
      ).execute({ targetId: 'missing', status: 'FAILED' }),
    ).rejects.toBeInstanceOf(PublicationTargetNotFoundError);
  });
});
