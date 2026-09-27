import { z } from 'zod';

export const publicationStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'SCHEDULED',
  'PROCESSING',
  'PUBLISHED',
  'PARTIAL',
  'FAILED',
]);

export const createPublicationSchema = z.object({
  brandId: z.string().min(1).max(100),
  originalPrompt: z.string().max(10000).optional(),
  copy: z.string().trim().min(1).max(10000),
  mediaUrl: z.string().url().max(2000),
  mediaType: z.enum(['IMAGE', 'VIDEO']).optional(),
});

export type CreatePublicationDto = z.infer<typeof createPublicationSchema>;

export const updateDraftSchema = z.object({
  originalPrompt: z.string().max(10000).optional(),
  copy: z.string().trim().min(1).max(10000).optional(),
  mediaUrl: z.string().url().max(2000).optional(),
  mediaType: z.enum(['IMAGE', 'VIDEO']).optional(),
});

export type UpdateDraftDto = z.infer<typeof updateDraftSchema>;

export const approvePublicationSchema = z.object({
  scheduledAt: z.string().datetime(),
});

export type ApprovePublicationDto = z.infer<typeof approvePublicationSchema>;

export const listPublicationsSchema = z.object({
  brandId: z.string().min(1).max(100).optional(),
  status: publicationStatusSchema.optional(),
});

export type ListPublicationsDto = z.infer<typeof listPublicationsSchema>;
