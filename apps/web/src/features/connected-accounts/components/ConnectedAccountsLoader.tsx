"use client";

import dynamic from "next/dynamic";

/**
 * Entrada solo-cliente de `ConnectedAccountsManager`: suspende con `use()`
 * sobre axios (`/api`, URL relativa válida solo en el navegador). Se excluye
 * del SSR igual que `BrandsManagerLoader`.
 */
export const ConnectedAccountsLoader = dynamic(
  () =>
    import("@/features/connected-accounts/components/ConnectedAccountsManager").then(
      (module) => module.ConnectedAccountsManager,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando cuentas…</p>
      </div>
    ),
  },
);
