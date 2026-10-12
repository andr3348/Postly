import Link from "next/link";

/**
 * 404 global: rutas sin coincidencia (p. ej. vistas planificadas en
 * `docs/frontend.md` §4 aún sin página). Mensaje intencional, no genérico.
 */
export default function NotFound() {
  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
        <p className="text-base font-semibold text-[#083A3D] dark:text-white mb-1">
          Vista en construcción
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
          Esta sección sigue el mapa de vistas de la documentación.
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-[#151717] text-white text-sm font-medium rounded-[10px] px-6 py-2.5 hover:bg-[#252727] transition-colors duration-200"
        >
          Volver al resumen
        </Link>
      </div>
    </div>
  );
}
