import { z } from 'zod';

export const generationModeSchema = z.enum(['IDEAS', 'COPY', 'IMPROVE']);

export const generationPlatformSchema = z.enum([
  'FACEBOOK',
  'INSTAGRAM',
  'LINKEDIN',
  'TIKTOK',
]);

export const generationFormatSchema = z.enum(['FEED', 'REEL']);

export const generationMediaTypeSchema = z.enum(['IMAGE', 'VIDEO']);

const promptSchema = z.string().trim().max(10000).optional();
const currentCopySchema = z.string().trim().max(10000).optional();

export const generateTextSchema = z
  .object({
    brandId: z.string().min(1).max(100),
    mode: generationModeSchema,
    prompt: promptSchema,
    platform: generationPlatformSchema.optional(),
    format: generationFormatSchema.optional(),
    mediaType: generationMediaTypeSchema.optional(),
    excludeIdeas: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
    currentCopy: currentCopySchema,
    feedback: z.string().trim().max(1000).optional(),
  })
  .superRefine((data, context) => {
    if (data.mode === 'IMPROVE') {
      if (data.currentCopy === undefined || data.currentCopy === '') {
        context.addIssue({
          code: 'custom',
          path: ['currentCopy'],
          message: 'currentCopy es requerido para el modo IMPROVE',
        });
      }
      return;
    }

    if (data.prompt === undefined || data.prompt === '') {
      context.addIssue({
        code: 'custom',
        path: ['prompt'],
        message: 'prompt es requerido para generar ideas o copy',
      });
    }
  });

export type GenerateTextDto = z.infer<typeof generateTextSchema>;

export const generateAgentSchema = z
  .object({
    brandId: z.string().min(1).max(100),
    prompt: z.string().trim().min(1).max(10000),
    platform: generationPlatformSchema,
    format: generationFormatSchema,
    mediaType: generationMediaTypeSchema.optional(),
  })
  .superRefine((data, context) => {
    if (
      data.format === 'REEL' &&
      data.platform !== 'FACEBOOK' &&
      data.platform !== 'INSTAGRAM'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['format'],
        message: 'El formato REEL solo aplica a Facebook e Instagram',
      });
    }
  });

export type GenerateAgentDto = z.infer<typeof generateAgentSchema>;
