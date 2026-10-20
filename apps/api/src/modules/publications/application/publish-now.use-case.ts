import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Publication } from '../domain/publication.entity.js';
import {
  DISPATCH_NOTIFIER,
  type DispatchNotifier,
} from '../domain/ports/dispatch-notifier.port.js';
import { ApprovePublicationUseCase } from './approve-publication.use-case.js';
import type { FlowInput } from './flow-helpers.js';

/**
 * "Publicar ahora": reutiliza la aprobación con `scheduledAt = now` y luego
 * despierta a n8n con un webhook sin payload. Si el webhook falla, la
 * publicación queda SCHEDULED vencida y el cron del claim la levanta igual:
 * el webhook acelera, el cron es la garantía.
 */
@Injectable()
export class PublishNowUseCase {
  private readonly logger = new Logger(PublishNowUseCase.name);

  constructor(
    private readonly approve: ApprovePublicationUseCase,
    @Inject(DISPATCH_NOTIFIER) private readonly notifier: DispatchNotifier,
  ) {}

  async execute(input: FlowInput): Promise<Publication> {
    const publication = await this.approve.execute({
      ...input,
      scheduledAt: new Date(),
    });

    try {
      await this.notifier.notify();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[publish-now] Could not wake n8n for publication ${publication.id}: ${detail}`,
      );
    }

    return publication;
  }
}
