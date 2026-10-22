import { z } from 'zod';

/** Página elegida por el usuario en el selector del callback. */
export const metaOAuthCompleteSchema = z.object({
  pageId: z.string().trim().min(1).max(200),
});

export type MetaOAuthCompleteDto = z.infer<typeof metaOAuthCompleteSchema>;
