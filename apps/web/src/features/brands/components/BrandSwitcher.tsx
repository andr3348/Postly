"use client";

import { Suspense, use, useState } from "react";
import { getBrandsCached } from "@/features/brands/api";
import type { Brand } from "@/features/brands/api";
import { useBrand } from "@/features/brands/BrandContext";

/** Promesa cacheada por montaje: `use()` la suspende hasta resolver. */
function getBrands(): Promise<{ brands: Brand[] }> {
  return getBrandsCached(0);
}

/**
 * Selector de marca con datos reales (`GET /brands`).
 * La selección vive aquí hasta que el contexto global de marca exista.
 */
export function BrandSwitcher() {
  return (
    <Suspense
      fallback={
        <div className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-600 text-xs sm:text-sm text-gray-400">
          Cargando…
        </div>
      }
    >
      <BrandSwitcherInner />
    </Suspense>
  );
}

function BrandSwitcherInner() {
  const { brands } = use(getBrands());
  const { selectedId, select } = useBrand();
  const [isOpen, setIsOpen] = useState(false);

  const selected =
    brands.find((brand) => brand.id === selectedId) ?? brands[0] ?? null;

  if (selected === null) {
    return (
      <span className="text-xs sm:text-sm text-gray-400 px-3 py-1.5">
        Sin marcas
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-transparent hover:border-gray-400 dark:hover:border-slate-400 text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200 cursor-pointer transition-colors"
      >
        <span className="truncate max-w-27.5 sm:max-w-35">{selected.name}</span>
        <svg
          viewBox="0 0 24 24"
          className="w-3.5 h-3.5 text-gray-400 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="7 15 12 20 17 15" />
          <polyline points="7 9 12 4 17 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#232a3e] border border-gray-200 dark:border-[#2d374e] rounded-xl shadow-lg py-1.5 z-50">
          <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Marcas disponibles
          </div>
          {brands.map((brand) => (
            <button
              key={brand.id}
              type="button"
              onClick={() => {
                select(brand.id);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-between ${
                brand.id === selected.id
                  ? "bg-gray-100/80 dark:bg-[#2d374e] text-[#083A3D] dark:text-white font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#28324a]"
              }`}
            >
              <span>{brand.name}</span>
              {brand.id === selected.id && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#083A3D] dark:bg-emerald-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
