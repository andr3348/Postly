import { z } from 'zod';
import { recordMetricSchema } from '../../../publications/presentation/schemas/publication.schema.js';

export const reportTargetSchema = z.object({
  status: z.enum(['SUCCESS', 'FAILED']),
  externalPostId: z.string().max(500).optional(),
  externalPostUrl: z.string().url().max(2000).optional(),
  errorMessage: z.string().max(5000).optional(),
  metrics: recordMetricSchema.optional(),
});

export type ReportTargetDto = z.infer<typeof reportTargetSchema>;
