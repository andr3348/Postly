import { z } from 'zod';
import { recordMetricSchema } from '../../../publications/presentation/schemas/publication.schema.js';

const providerErrorSchema = z.object({
  code: z.coerce.number().int().optional(),
  subcode: z.coerce.number().int().optional(),
  message: z.string().max(5000).optional(),
  type: z.string().max(200).optional(),
  isTransient: z
    .preprocess((value) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }, z.boolean())
    .optional(),
  httpStatus: z.coerce.number().int().min(100).max(599).optional(),
  traceId: z.string().max(200).optional(),
  retryAfterSeconds: z.coerce.number().int().min(0).max(86_400).optional(),
});

export const reportTargetSchema = z
  .object({
    dispatchAttemptId: z.string().min(1).max(100),
    status: z.enum(['SUCCESS', 'FAILED']),
    stage: z.enum(['MEDIA_PREPARATION', 'PUBLISH']).optional(),
    externalPostId: z.string().min(1).max(500).optional(),
    externalPostUrl: z.url().max(2000).optional(),
    errorMessage: z.string().min(1).max(5000).optional(),
    error: providerErrorSchema.optional(),
    metrics: recordMetricSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'SUCCESS' && value.externalPostId === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['externalPostId'],
        message: 'externalPostId es obligatorio cuando status es SUCCESS',
      });
    }
    if (value.status === 'FAILED') {
      if (value.stage === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['stage'],
          message: 'stage es obligatorio cuando status es FAILED',
        });
      }
      if (value.errorMessage === undefined && value.error === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['errorMessage'],
          message: 'errorMessage o error es obligatorio cuando status es FAILED',
        });
      }
    }
  });

export type ReportTargetDto = z.infer<typeof reportTargetSchema>;
