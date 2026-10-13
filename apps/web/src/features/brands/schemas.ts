import { z } from 'zod';

/**
 * Schemas cliente de marcas. Espejan límites del backend
 * (`apps/api/.../brand/presentation/schemas/`); el backend revalida.
 */
export const brandFormSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(100),
  logoUrl: z.url('URL inválida').max(1000).optional().nullable(),
  websiteUrl: z.url('URL inválida').max(1000).optional().nullable(),
  aiTone: z.string().max(200).optional(),
  aiBrandVoice: z.string().max(2000).optional().nullable(),
  aiTargetAudience: z.string().max(2000).optional().nullable(),
  defaultHashtags: z.array(z.string().max(50)).optional(),
});

export type BrandFormInput = z.infer<typeof brandFormSchema>;
