import { Module } from '@nestjs/common';
import { PublicationsModule } from '../publications/publications.module.js';
import { GetAnalyticsSummaryUseCase } from './application/get-analytics-summary.use-case.js';
import { AnalyticsController } from './presentation/analytics.controller.js';

/**
 * Módulo analytics: solo lectura, sin persistencia propia.
 * Reutiliza los puertos exportados por PublicationsModule.
 */
@Module({
  imports: [PublicationsModule],
  controllers: [AnalyticsController],
  providers: [GetAnalyticsSummaryUseCase],
})
export class AnalyticsModule {}
