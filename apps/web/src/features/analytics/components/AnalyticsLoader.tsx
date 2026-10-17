"use client";

import dynamic from "next/dynamic";

/**
 * Entrada solo-cliente de la vista Informes: suspende con `use()` sobre
 * axios (`/api`, URL relativa válida solo en el navegador). Se excluye del
 * SSR igual que los loaders de publications/brands.
 */
export const AnalyticsLoader = dynamic(
  () =>
    import("@/features/analytics/components/AnalyticsView").then(
      (module) => module.AnalyticsView,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando informes…</p>
      </div>
    ),
  },
);
