import { z } from 'zod';

export const createBrandSchema = z.object({
  name: z.string().trim().min(1).max(100),
  logoUrl: z.url().max(1000).optional().nullable(),
  websiteUrl: z.url().max(1000).optional().nullable(),
  aiTone: z.string().max(200).optional(),
  aiBrandVoice: z.string().max(2000).optional().nullable(),
  aiTargetAudience: z.string().max(2000).optional().nullable(),
  defaultHashtags: z.array(z.string().max(50)).optional(),
});

export type CreateBrandDto = z.infer<typeof createBrandSchema>;
