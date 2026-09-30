import { z } from 'zod';

export const accountPlatformSchema = z.enum(['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK']);

export const connectAccountSchema = z.object({
  platform: accountPlatformSchema,
  accountName: z.string().trim().min(2).max(200),
  externalAccountId: z.string().trim().min(1).max(200),
  accessToken: z.string().min(1).max(8000),
  refreshToken: z.string().min(1).max(8000).optional(),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .transform((value) => (value === undefined ? undefined : new Date(value))),
  scope: z.string().max(2000).optional(),
});

export type ConnectAccountDto = z.infer<typeof connectAccountSchema>;
