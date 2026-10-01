import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  brandId: z.string().min(1).max(100).optional(),
});

export type AnalyticsQueryDto = z.infer<typeof analyticsQuerySchema>;
