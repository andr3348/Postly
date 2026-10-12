"use client";

import { ROLE_LABEL } from "@/features/auth/role-label";
import { useSessionUser } from "@/features/auth/session";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "U";
}

/**
 * Vista de perfil (solo lectura según contratos existentes de login/register/me).
 * Muestra el nombre y el rol autenticados por el backend.
 */
export function ProfileCard() {
  const user = useSessionUser();

  const displayName = user?.name ?? "Usuario Alma Quinta";
  const displayEmail = user?.email ?? "marketing@almaquinta.com";
  const displayRole = user ? ROLE_LABEL[user.role] : "Marketing";

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-6 sm:p-8 shadow-xs transition-colors duration-200">
        <h1 className="text-lg sm:text-xl font-semibold text-[#083A3D] dark:text-white mb-6">
          Perfil de Usuario
        </h1>

        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-[#083A3D] dark:bg-[#394560] text-white flex items-center justify-center text-xl font-semibold shrink-0 select-none">
            {initials(displayName)}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {displayName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {displayEmail}
            </p>
            <span className="inline-flex mt-2 items-center rounded-full bg-[#083A3D]/10 dark:bg-[#7387b3]/20 px-3 py-1 text-xs font-medium text-[#083A3D] dark:text-[#c7d2fe]">
              {displayRole}
            </span>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-gray-50/70 dark:bg-[#2c364d]/60 border border-gray-100 dark:border-slate-700/60">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Nombre de cuenta
            </span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {displayName}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-gray-50/70 dark:bg-[#2c364d]/60 border border-gray-100 dark:border-slate-700/60">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Rol del sistema
            </span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {displayRole}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
