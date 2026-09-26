"use client";

import { useTransition } from "react";
import { logoutAction } from "@/features/auth/actions";

export default function DashboardPage() {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    // Ejecutar la Server Action para destruir las cookies HttpOnly
    startTransition(() => {
      logoutAction();
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8 font-sans">
      <div className="bg-white p-10 rounded-2xl shadow-sm text-center max-w-lg">
        <h1 className="text-3xl font-bold text-[#151717] mb-4">Bienvenido a Postly</h1>
        <p className="text-gray-600 mb-8 leading-relaxed">
          Has iniciado sesión correctamente. Esta es la página principal (Dashboard). 
          Próximamente aquí construiremos el panel de analíticas, orquestación omnicanal e Insights con IA.
        </p>
        <button 
          onClick={handleLogout}
          disabled={isPending}
          className="bg-red-50 text-red-600 font-medium px-6 py-2.5 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          {isPending ? "Cerrando sesión..." : "Cerrar Sesión"}
        </button>
      </div>
    </div>
  );
}
