import { z } from 'zod';
import { accountPlatformSchema } from './connect-account.schema.js';

/** Verifica sin persistir: solo lo necesario para llamar al proveedor. */
export const verifyAccountSchema = z.object({
  platform: accountPlatformSchema,
  externalAccountId: z.string().trim().min(1).max(200),
  accessToken: z.string().min(1).max(8000),
});

export type VerifyAccountDto = z.infer<typeof verifyAccountSchema>;
