"use client";

import { useState } from "react";
import {
  AnalyticsIcon,
  PlanningIcon,
  MenuIcon,
} from "@/shared/components/icons/DashboardIcons";

interface DashboardNavbarProps {
  activeTab?: "analitica" | "planificacion";
  onTabChange?: (tab: "analitica" | "planificacion") => void;
  onOpenMobileMenu?: () => void;
}

const mockBrands = ["Alma Quinta", "Postly Global"];

export function DashboardNavbar({
  activeTab = "analitica",
  onTabChange,
  onOpenMobileMenu,
}: DashboardNavbarProps) {
  const [selectedBrand, setSelectedBrand] = useState("Alma Quinta");
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);

  return (
    <header className="sticky top-3.5 z-30 bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] shadow-sm px-4 sm:px-6 py-2.5 flex items-center justify-between transition-colors duration-300">
      {/* Pestañas de Vista: Analítica y Planificación */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => onTabChange?.("analitica")}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
            activeTab === "analitica"
              ? "border border-gray-300 dark:border-slate-600 bg-gray-50/80 dark:bg-[#2d374e] text-gray-900 dark:text-white shadow-xs"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50/50 dark:hover:bg-[#2d374e]/50"
          }`}
        >
          <AnalyticsIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
          <span>Analítica</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange?.("planificacion")}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
            activeTab === "planificacion"
              ? "border border-gray-300 dark:border-slate-600 bg-gray-50/80 dark:bg-[#2d374e] text-gray-900 dark:text-white shadow-xs"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50/50 dark:hover:bg-[#2d374e]/50"
          }`}
        >
          <PlanningIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
          <span>Planificación</span>
        </button>
      </div>

      {/* Lado Derecho: Brand Switcher y Botón de Menú Móvil */}
      <div className="flex items-center gap-3">
        {/* Selector de Marca (Brand Switcher según arquitectura docs/frontend.md) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-transparent hover:border-gray-400 dark:hover:border-slate-400 text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200 cursor-pointer transition-colors"
          >
            <span className="truncate max-w-[110px] sm:max-w-[140px]">
              {selectedBrand}
            </span>
            {/* Indicador flechas arriba/abajo como en el diseño de Lunacy */}
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

          {/* Menú Desplegable de Marcas */}
          {isBrandDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#232a3e] border border-gray-200 dark:border-[#2d374e] rounded-xl shadow-lg py-1.5 z-50">
              <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Marcas disponibles
              </div>
              {mockBrands.map((brand) => (
                <button
                  key={brand}
                  type="button"
                  onClick={() => {
                    setSelectedBrand(brand);
                    setIsBrandDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-between ${
                    brand === selectedBrand
                      ? "bg-gray-100/80 dark:bg-[#2d374e] text-[#083A3D] dark:text-white font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#28324a]"
                  }`}
                >
                  <span>{brand}</span>
                  {brand === selectedBrand && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#083A3D] dark:bg-emerald-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Botón Hamburger para móvil */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menú de navegación"
          className="lg:hidden p-1.5 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2d374e] transition-colors cursor-pointer"
        >
          <MenuIcon className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
