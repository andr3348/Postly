"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnalyticsIcon,
  PlanningIcon,
  MenuIcon,
} from "@/shared/components/icons/DashboardIcons";
import { BrandSwitcher } from "@/features/brands/components/BrandSwitcher";

interface DashboardNavbarProps {
  onOpenMobileMenu?: () => void;
}

/**
 * Barra superior: tabs que NAVEGAN (no estado local) + switcher de marca
 * con datos reales + hamburguesa móvil. El sidebar sigue siendo la
 * navegación primaria; esto son accesos contextuales.
 */
export function DashboardNavbar({ onOpenMobileMenu }: DashboardNavbarProps) {
  const pathname = usePathname();

  const tabs = [
    { name: "Analítica", href: "/dashboard", Icon: AnalyticsIcon },
    { name: "Planificación", href: "/dashboard/publications", Icon: PlanningIcon },
  ];

  return (
    <header className="sticky top-3.5 z-30 bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] shadow-sm px-4 sm:px-6 py-2.5 flex items-center justify-between transition-colors duration-300">
      {/* Pestañas de Vista: enlaces reales a rutas */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {tabs.map(({ name, href, Icon }) => {
          const isActive =
            href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
          return (
            <Link
              key={name}
              href={href}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? "border border-gray-300 dark:border-slate-600 bg-gray-50/80 dark:bg-[#2d374e] text-gray-900 dark:text-white shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50/50 dark:hover:bg-[#2d374e]/50"
              }`}
            >
              <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
              <span>{name}</span>
            </Link>
          );
        })}
      </div>

      {/* Lado Derecho: Brand Switcher y Botón de Menú Móvil */}
      <div className="flex items-center gap-3">
        <BrandSwitcher />

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
