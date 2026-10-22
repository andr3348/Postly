import { z } from 'zod';

/**
 * Query del callback de Meta. El diálogo agrega `error`, `error_code`,
 * `error_description` y `error_reason` cuando el usuario cancela; el backend
 * solo necesita el código, el state y el error.
 */
export const metaOAuthCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export type MetaOAuthCallbackQueryDto = z.infer<typeof metaOAuthCallbackQuerySchema>;
