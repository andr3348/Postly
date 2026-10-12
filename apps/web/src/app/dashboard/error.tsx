"use client";

import { invalidateSummary } from "@/features/dashboard/components/DashboardHome";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Límite de error de la ruta dashboard: invalida el caché y reintenta. */
export default function DashboardError({ reset }: DashboardErrorProps) {
  const handleRetry = () => {
    invalidateSummary();
    reset();
  };
  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
        <p className="text-sm text-red-500 font-medium mb-4">
          No se pudieron cargar las métricas
        </p>
        <button
          onClick={handleRetry}
          className="bg-[#151717] text-white text-sm font-medium rounded-[10px] px-6 h-[44px] cursor-pointer hover:bg-[#252727] transition-colors duration-200"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
