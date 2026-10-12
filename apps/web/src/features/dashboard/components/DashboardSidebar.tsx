"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { logoutAction } from "@/features/auth/actions";
import { ROLE_LABEL } from "@/features/auth/role-label";
import { clearSessionUser, useSessionUser } from "@/features/auth/session";
import { useTheme } from "@/shared/context/ThemeContext";
import { AlmaLogo } from "@/shared/components/AlmaLogo";
import {
  DashboardGridIcon,
  PlanningIcon,
  ReportsIcon,
  BrandSettingsIcon,
  ProfileIcon,
  LogoutIcon,
  MoonIcon,
  SunIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UsersIcon,
} from "@/shared/components/icons/DashboardIcons";

interface DashboardSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
}

/**
 * Navegación = tabla de rutas de `docs/frontend.md` §4 (rutas en inglés).
 * Sin páginas por red social: no existen ni están planificadas (la bandeja
 * filtra por estado y analytics agrega por canal).
 */
const navItems: NavItem[] = [
  { name: "Dashboard Resumen", href: "/dashboard", icon: DashboardGridIcon },
  { name: "Marcas", href: "/dashboard/brands", icon: BrandSettingsIcon },
  {
    name: "Publicaciones",
    href: "/dashboard/publications",
    icon: PlanningIcon,
  },
  { name: "Cuentas", href: "/dashboard/accounts", icon: UsersIcon },
  { name: "Informes", href: "/dashboard/analytics", icon: ReportsIcon },
];

export function DashboardSidebar({
  isCollapsed,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const user = useSessionUser();
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    clearSessionUser();
    startTransition(() => {
      logoutAction();
    });
  };

  return (
    <>
      {/* Overlay para móvil */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      <aside
        className={`fixed lg:sticky top-3.5 left-3.5 z-50 h-[calc(100vh-1.75rem)] flex flex-col justify-between bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[28px] shadow-sm transition-all duration-300 select-none ${
          isCollapsed ? "w-20 px-2 py-5" : "w-64 p-5"
        } ${
          mobileOpen ? "translate-x-0" : "translate-x-[110%] lg:translate-x-0"
        }`}
      >
        {/* Parte Superior: Logo & Línea Separadora */}
        <div className="flex flex-col">
          {isCollapsed ? (
            <div className="flex flex-col items-center pt-1 pb-3">
              <AlmaLogo className="h-8 w-auto text-[#083A3D] dark:text-white" />
              <div className="h-[1.5px] w-8 bg-gray-200 dark:bg-slate-700 mt-2" />
            </div>
          ) : (
            <div className="flex flex-col items-center pt-2 pb-4 text-center">
              <AlmaLogo className="h-10 w-auto text-[#083A3D] dark:text-white" />
              <div className="h-[1.5px] w-28 bg-gray-200 dark:bg-slate-700 mt-3" />
            </div>
          )}

          {/* Menú de Navegación */}
          <nav className="flex flex-col gap-1.5 mt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={`group relative flex items-center gap-3.5 rounded-xl font-medium transition-all duration-200 ${
                    isCollapsed
                      ? "justify-center h-11 w-11 mx-auto"
                      : "px-3.5 py-2.5 text-[14px]"
                  } ${
                    isActive
                      ? "bg-[#232a3e] dark:bg-[#394560] text-white shadow-sm"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-[#2d374e] hover:text-[#083A3D] dark:hover:text-white"
                  }`}
                >
                  <div className="shrink-0 flex items-center justify-center w-5 h-5">
                    <Icon
                      className={`w-5 h-5 transition-transform duration-200 group-hover:scale-105 ${
                        item.name === "Dashboard Resumen"
                          ? isActive
                            ? "text-white"
                            : "text-gray-800 dark:text-gray-200"
                          : ""
                      }`}
                    />
                  </div>

                  {!isCollapsed && (
                    <span className="truncate">{item.name}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Parte Inferior: Perfil, Logout, Colapso y Tema */}
        <div className="flex flex-col gap-2 pt-4 border-t border-gray-100 dark:border-slate-800">
          {isCollapsed ? (
            /* Modo Colapsado: Iconos Apilados */
            <div className="flex flex-col items-center gap-2">
              {/* Perfil */}
              <Link
                href="/dashboard/profile"
                title={
                  user ? `${user.name} · ${ROLE_LABEL[user.role]}` : "Perfil"
                }
                className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2d374e] transition-colors cursor-pointer"
              >
                {user ? (
                  <span className="w-8 h-8 rounded-full bg-[#083A3D] dark:bg-[#394560] text-white flex items-center justify-center text-xs font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <ProfileIcon className="w-5 h-5" />
                )}
              </Link>

              {/* Logout */}
              <button
                type="button"
                onClick={handleLogout}
                disabled={isPending}
                title="Cerrar sesión"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
              >
                <LogoutIcon className="w-5 h-5" />
              </button>

              {/* Cambiar Tema */}
              <button
                type="button"
                onClick={toggleTheme}
                title={theme === "dark" ? "Modo Claro" : "Modo Oscuro"}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2d374e] transition-colors cursor-pointer"
              >
                {theme === "dark" ? (
                  <SunIcon className="w-5 h-5 text-amber-400" />
                ) : (
                  <MoonIcon className="w-5 h-5" />
                )}
              </button>

              {/* Botón Expandir */}
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Expandir barra lateral"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2d374e] transition-colors cursor-pointer"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Modo Expandido: Filas con Etiquetas */
            <div className="flex flex-col gap-2">
              {/* Fila 1: Perfil y Logout */}
              <div className="flex items-center justify-between px-2 py-1">
                <Link
                  href="/dashboard/profile"
                  className="flex items-center gap-2.5 min-w-0 rounded-lg -mx-1.5 px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-[#2d374e] transition-colors"
                >
                  <span className="w-8 h-8 rounded-full bg-[#083A3D] dark:bg-[#394560] text-white flex items-center justify-center text-xs font-semibold shrink-0">
                    {user?.name?.charAt(0).toUpperCase() ?? "U"}
                  </span>
                  <span className="flex flex-col min-w-0 leading-tight">
                    <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200 truncate">
                      {user?.name ?? "Usuario"}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {user ? ROLE_LABEL[user.role] : "Marketing"}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isPending}
                  title="Cerrar sesión"
                  className="p-1.5 rounded-lg text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-[#2d374e] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <LogoutIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Fila 2: Chevron de Colapso y Selector de Tema */}
              <div className="flex items-center justify-between px-2 pt-1 text-gray-500 dark:text-gray-400">
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title="Colapsar barra lateral"
                  className="p-1.5 rounded-lg hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2d374e] transition-colors cursor-pointer"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={toggleTheme}
                  title={theme === "dark" ? "Modo Claro" : "Modo Oscuro"}
                  className="p-1.5 rounded-lg hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2d374e] transition-colors cursor-pointer"
                >
                  {theme === "dark" ? (
                    <SunIcon className="w-5 h-5 text-amber-400" />
                  ) : (
                    <MoonIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
