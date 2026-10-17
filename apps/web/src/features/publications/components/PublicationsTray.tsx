"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getBrandsCached } from "@/features/brands/api";
import { useBrand } from "@/features/brands/BrandContext";
import { getPublicationsCached } from "@/features/publications/api";
import { publicationStatusSchema, type PublicationStatus } from "@/features/publications/schemas";
import { PublicationStatusBadge } from "@/features/publications/components/StatusBadges";
import { formatDateTime } from "@/lib/format";

const FILTERS: ReadonlyArray<{
  readonly label: string;
  readonly value: PublicationStatus | null;
}> = [
  { label: "Todas", value: null },
  { label: "Borradores", value: "DRAFT" },
  { label: "Pendientes", value: "PENDING_APPROVAL" },
  { label: "Programadas", value: "SCHEDULED" },
  { label: "En proceso", value: "PROCESSING" },
  { label: "Publicadas", value: "PUBLISHED" },
  { label: "Parciales", value: "PARTIAL" },
  { label: "Fallidas", value: "FAILED" },
];

export function PublicationsTray() {
  // Sin mutaciones en esta vista: el setter no hace falta (el detalle
  // invalida el caché y el remonte al navegar refresca).
  const [version] = useState(0);

  // Sin mutaciones aquí: el detalle invalida el caché y esta vista refresca
  // sola al navegar de regreso (remonte + caché ya invalidado).

  return (
    <Suspense fallback={<PanelCard text="Cargando publicaciones…" />}>
      <TrayInner key={version} version={version} />
    </Suspense>
  );
}

function TrayInner({ version }: { version: number }) {
  const { brands } = use(getBrandsCached(0));
  const { selectedId } = useBrand();
  const current = brands.find((brand) => brand.id === selectedId) ?? brands[0] ?? null;

  if (current === null) {
    return (
      <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Sin marcas todavía.{" "}
          <Link href="/dashboard/brands" className="font-medium text-[#2d79f3] hover:underline">
            Crea una marca
          </Link>{" "}
          antes de publicar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-[#083A3D] dark:text-white">
            Publicaciones
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Marca: {current.name} · flujo DRAFT → PENDING → SCHEDULED (n8n)
          </p>
        </div>
        <Link
          href="/dashboard/publications/new"
          className="bg-[#151717] text-white text-sm font-medium rounded-[10px] px-5 h-[42px] cursor-pointer hover:bg-[#252727] transition-colors duration-200 flex items-center"
        >
          Nueva publicación
        </Link>
      </div>

      <FilterBar />

      <Suspense fallback={<PanelCard text="Cargando bandeja…" />}>
        <PublicationsList brandId={current.id} version={version} />
      </Suspense>
    </div>
  );
}

/** Chips por estado: sincronizados con `?status=` en la URL. */
function FilterBar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const parsed = publicationStatusSchema.safeParse(searchParams.get("status"));
  const activeStatus: PublicationStatus | null = parsed.success ? parsed.data : null;

  const select = (value: PublicationStatus | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    const query = params.toString();
    router.replace(query === "" ? pathname : `${pathname}?${query}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map(({ label, value }) => {
        const active = (value === null && activeStatus === null) || value === activeStatus;
        return (
          <button
            key={label}
            type="button"
            onClick={() => select(value === activeStatus ? null : value)}
            className={`text-xs font-medium rounded-full px-3.5 py-1.5 cursor-pointer transition-colors border ${
              active
                ? "bg-[#083A3D] text-white border-[#083A3D] dark:bg-[#2d374e] dark:border-slate-500"
                : "bg-white text-gray-600 border-gray-200 dark:bg-transparent dark:text-gray-400 dark:border-slate-600 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function PublicationsList({ brandId, version }: { brandId: string; version: number }) {
  const searchParams = useSearchParams();
  const parsed = publicationStatusSchema.safeParse(searchParams.get("status"));
  const status: PublicationStatus | null = parsed.success ? parsed.data : null;
  const publications = use(getPublicationsCached(brandId, status, version));

  if (publications.length === 0) {
    return (
      <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {status === null
            ? "Sin publicaciones en esta marca. Crea la primera desde Nueva publicación."
            : "Sin publicaciones con este estado."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {publications.map((publication) => (
        <Link
          key={publication.id}
          href={`/dashboard/publications/${publication.id}`}
          className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[18px] p-5 shadow-xs flex flex-col gap-1.5 transition-colors hover:border-gray-300 dark:hover:border-slate-500 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-[#083A3D] dark:text-white truncate">
              {publication.copy}
            </span>
            <PublicationStatusBadge status={publication.status} />
          </div>
          <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
            <span>Actualizada {formatDateTime(publication.updatedAt)}</span>
            {publication.scheduledAt !== null && (
              <span>· Programada {formatDateTime(publication.scheduledAt)}</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

function PanelCard({ text }: { text: string }) {
  return (
    <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  );
}
