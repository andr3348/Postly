import { Controller, Get, Query } from '@nestjs/common';
import { GetAnalyticsSummaryUseCase } from '../application/get-analytics-summary.use-case.js';
import {
  analyticsQuerySchema,
  type AnalyticsQueryDto,
} from './schemas/analytics.schema.js';

/** Solo lectura para la pestaña Analytics (protegida por el guard global). */
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly summary: GetAnalyticsSummaryUseCase) {}

  @Get('summary')
  getSummary(@Query({ schema: analyticsQuerySchema }) query: AnalyticsQueryDto) {
    return this.summary.execute(query);
  }
}
