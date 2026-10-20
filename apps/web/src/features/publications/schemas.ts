import { z } from "zod";

export const publicationStatusSchema = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "SCHEDULED",
  "PROCESSING",
  "PUBLISHED",
  "PARTIAL",
  "FAILED",
]);

export type PublicationStatus = z.infer<typeof publicationStatusSchema>;

export const publicationMediaSchema = z.enum(["IMAGE", "VIDEO"]);

export type PublicationMedia = z.infer<typeof publicationMediaSchema>;

export const publicationPlatformSchema = z.enum([
  "FACEBOOK",
  "INSTAGRAM",
  "LINKEDIN",
  "TIKTOK",
]);

export type PublicationPlatform = z.infer<typeof publicationPlatformSchema>;

export const publicationFormatSchema = z.enum(["FEED", "REEL"]);

export type PublicationFormat = z.infer<typeof publicationFormatSchema>;

export const createPublicationFormSchema = z.object({
  brandId: z
    .string()
    .min(1, "Brand ID requerido")
    .max(100, "Brand ID inválido"),
  originalPrompt: z
    .string()
    .max(10000, "El texto es demasiado largo")
    .optional(),
  copy: z
    .string()
    .trim()
    .min(1, "El texto es requerido")
    .max(10000, "El texto es demasiado largo"),
  mediaUrl: z.url("URL inválida").max(2000),
  mediaType: publicationMediaSchema.optional(),
});

export type CreatePublicationFormInput = z.infer<
  typeof createPublicationFormSchema
>;

export const updateDraftFormSchema = z.object({
  originalPrompt: z
    .string()
    .max(10000, "El texto es demasiado largo")
    .optional(),
  copy: z
    .string()
    .trim()
    .min(1, "El texto es requerido")
    .max(10000, "El texto es demasiado largo")
    .optional(),
  mediaUrl: z.url("URL inválida").max(2000).optional(),
  mediaType: publicationMediaSchema.optional(),
});

export type UpdateDraftFormInput = z.infer<typeof updateDraftFormSchema>;

export const approvePublicationFormSchema = z.object({
  scheduledAt: z.iso.datetime({ message: "Fecha ISO inválida" }),
});

export type ApprovePublicationFormInput = z.infer<
  typeof approvePublicationFormSchema
>;

/** Snapshot de métricas (espejo de `recordMetricSchema` del backend). */
const metricInt = z.int({ message: "Debe ser un entero" })
  .min(0, "No puede ser negativo")
  .max(1_000_000_000, "Fuera de rango");

export const recordMetricFormSchema = z.object({
  impressions: metricInt.optional(),
  likes: metricInt.optional(),
  comments: metricInt.optional(),
  shares: metricInt.optional(),
  clicks: metricInt.optional(),
});

export type RecordMetricFormInput = z.infer<typeof recordMetricFormSchema>;
