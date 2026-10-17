"use client";

import dynamic from "next/dynamic";

/**
 * Entradas solo-cliente de las vistas de publications: suspenden con `use()`
 * sobre axios (`/api`, URL relativa válida solo en el navegador). Se excluyen
 * del SSR igual que `BrandsManagerLoader`.
 */
export const PublicationsLoader = dynamic(
  () =>
    import("@/features/publications/components/PublicationsTray").then(
      (module) => module.PublicationsTray,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando publicaciones…</p>
      </div>
    ),
  },
);

export const PublicationDetailLoader = dynamic(
  () =>
    import("@/features/publications/components/PublicationDetail").then(
      (module) => module.PublicationDetail,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando publicación…</p>
      </div>
    ),
  },
);
