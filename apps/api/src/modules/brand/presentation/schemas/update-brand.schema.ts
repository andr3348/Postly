import { z } from 'zod';
import { createBrandSchema } from './create-brand.schema.js';

export const updateBrandSchema = createBrandSchema.partial();

export type UpdateBrandDto = z.infer<typeof updateBrandSchema>;
