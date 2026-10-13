"use client";

import dynamic from "next/dynamic";

/**
 * Entrada solo-cliente de `BrandsManager`: suspende con `use()` sobre
 * axios (`/api`, URL relativa válida solo en el navegador). Renderizarla
 * en el servidor revienta el SSR con "Invalid URL" y degrada toda la
 * página a client-rendering, así que se excluye del SSR.
 */
export const BrandsManagerLoader = dynamic(
  () =>
    import("@/features/brands/components/BrandsManager").then(
      (module) => module.BrandsManager,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Cargando marcas…
        </p>
      </div>
    ),
  },
);
