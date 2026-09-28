import { z } from 'zod';
import { Platform } from '@postly/database';

export const connectAccountSchema = z.object({
  platform: z.nativeEnum(Platform),
  accountName: z.string().min(2, 'Account name must be at least 2 characters'),
  externalAccountId: z.string().min(1, 'External Account ID is required'),
  accessToken: z.string().min(1, 'Access Token is required'),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  scope: z.string().optional(),
});

export type ConnectAccountDto = z.infer<typeof connectAccountSchema>;
