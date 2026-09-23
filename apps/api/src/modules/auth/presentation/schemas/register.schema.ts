import { z } from 'zod';

/**
 * Esquema Zod = única fuente de verdad: valida en runtime y
 * `z.infer` deriva el tipo estático. Sin clases DTO duplicadas.
 */
export const registerSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(128),
});

export type RegisterDto = z.infer<typeof registerSchema>;
