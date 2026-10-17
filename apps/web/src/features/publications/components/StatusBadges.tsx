import type { PublicationPlatform, PublicationStatus } from "@/features/publications/schemas";

const STATUS_META: Readonly<
  Record<PublicationStatus, { readonly label: string; readonly className: string }>
> = {
  DRAFT: {
    label: "Borrador",
    className: "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300",
  },
  PENDING_APPROVAL: {
    label: "Pendiente",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  },
  SCHEDULED: {
    label: "Programada",
    className: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400",
  },
  PROCESSING: {
    label: "En proceso",
    className: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400",
  },
  PUBLISHED: {
    label: "Publicada",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
  },
  PARTIAL: {
    label: "Parcial",
    className: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
  },
  FAILED: {
    label: "Fallida",
    className: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  },
};

/** Etiqueta de estado de publicación (bandeja y detalle). */
export function PublicationStatusBadge({ status }: { status: PublicationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

const TARGET_META: Readonly<
  Record<"PENDING" | "SUCCESS" | "FAILED", { readonly label: string; readonly className: string }>
> = {
  PENDING: {
    label: "Por publicar",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  },
  SUCCESS: {
    label: "Publicado",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
  },
  FAILED: {
    label: "Falló",
    className: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  },
};

/** Etiqueta del estado por canal destino. */
export function TargetStatusBadge({ status }: { status: "PENDING" | "SUCCESS" | "FAILED" }) {
  const meta = TARGET_META[status];
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

/** Etiqueta legible de plataforma (misma convención que cuentas). */
export function platformLabel(platform: PublicationPlatform): string {
  return PLATFORM_META[platform];
}

const PLATFORM_META: Readonly<Record<PublicationPlatform, string>> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  TIKTOK: "TikTok",
};
