import { z } from "zod";

/**
 * Schemas cliente de cuentas conectadas. Espejan límites del backend
 * (`apps/api/.../connected-accounts/presentation/schemas/`); el backend
 * revalida. Mensajes en español para la UI.
 */
export const connectAccountFormSchema = z.object({
  platform: z.enum(["FACEBOOK", "INSTAGRAM", "LINKEDIN", "TIKTOK"]),
  accountName: z.string().trim().min(2, "Nombre mínimo 2 caracteres").max(200),
  externalAccountId: z.string().trim().min(1, "ID de cuenta requerido").max(200),
  accessToken: z.string().min(1, "Token requerido").max(8000),
  refreshToken: z.string().max(8000).optional(),
  expiresAt: z.string().max(100).optional(),
  scope: z.string().max(2000).optional(),
});

export type ConnectAccountFormInput = z.infer<typeof connectAccountFormSchema>;

export const verifyAccountFormSchema = z.object({
  platform: z.enum(["FACEBOOK", "INSTAGRAM", "LINKEDIN", "TIKTOK"]),
  externalAccountId: z.string().trim().min(1, "ID de cuenta requerido").max(200),
  accessToken: z.string().min(1, "Token requerido").max(8000),
});

export type VerifyAccountFormInput = z.infer<typeof verifyAccountFormSchema>;
