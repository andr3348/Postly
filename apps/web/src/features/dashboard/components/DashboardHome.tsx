"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { getAnalyticsSummary } from "@/features/dashboard/api";
import type { AnalyticsSummary } from "@/features/dashboard/schemas";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  TiktokIcon,
} from "@/shared/components/icons/DashboardIcons";

/** Plataformas del backend (sin excepciones: nada fuera del enum existe). */
const PLATFORMS = [
  { key: "FACEBOOK", name: "Facebook", Icon: FacebookIcon },
  { key: "INSTAGRAM", name: "Instagram", Icon: InstagramIcon },
  { key: "LINKEDIN", name: "LinkedIn", Icon: LinkedinIcon },
  { key: "TIKTOK", name: "TikTok", Icon: TiktokIcon },
] as const;

const compact = new Intl.NumberFormat("es", { notation: "compact" });

/** Promesa cacheada por montaje: `use()` la suspende hasta resolver. */
let summaryPromise: Promise<AnalyticsSummary> | null = null;

function getSummary(): Promise<AnalyticsSummary> {
  if (summaryPromise === null) {
    summaryPromise = getAnalyticsSummary();
  }
  return summaryPromise;
}

/** Invalida el caché para reintentar tras un error (ver `error.tsx`). */
export function invalidateSummary(): void {
  summaryPromise = null;
}

export function DashboardHome() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-5 pb-6">
          <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Cargando métricas…
            </p>
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const summary = use(getSummary());

  const connected = summary.byPlatform.length;
  const pending = PLATFORMS.length - connected;

  const metrics = [
    {
      title: "Publicaciones totales",
      value: String(summary.totalPublications),
      change: `${summary.byStatus["PUBLISHED"] ?? 0} publicadas`,
      isPositive: true,
    },
    {
      title: "Alcance total acumulado",
      value: compact.format(summary.totalImpressions),
      change: "últimos snapshots por canal",
      isPositive: true,
    },
    {
      title: "Engagement promedio",
      value: `${summary.engagementRate}%`,
      change: "interacciones / impresiones",
      isPositive: true,
    },
    {
      title: "Canales sincronizados",
      value: `${connected} de ${PLATFORMS.length}`,
      change: pending > 0 ? `${pending} por conectar` : "todos conectados",
      isPositive: pending === 0,
    },
  ];

  const channels = PLATFORMS.map(({ key, name, Icon }) => {
    const synced = summary.byPlatform.some((entry) => entry.platform === key);
    return {
      name,
      Icon,
      connected: synced,
      status: synced ? "Conectado" : "Pendiente",
    };
  });

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Tarjetas de Métricas Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {metrics.map((metric) => (
          <div
            key={metric.title}
            className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-5 shadow-xs transition-all duration-200 hover:shadow-md"
          >
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {metric.title}
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-[#083A3D] dark:text-white mt-2 mb-1">
              {metric.value}
            </div>
            <span
              className={`text-xs font-medium ${
                metric.isPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {metric.change}
            </span>
          </div>
        ))}
      </div>

      {/* Fila Principal: Panel de Resumen Omnicanal y Próximas Publicaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Canales Conectados */}
        <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#083A3D] dark:text-white mb-1">
              Estado de Canales
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
              Plataformas con métricas registradas
            </p>

            <div className="flex flex-col gap-3">
              {channels.map((channel) => {
                const Icon = channel.Icon;
                return (
                  <div
                    key={channel.name}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50/70 dark:bg-[#2c364d]/60 border border-gray-100 dark:border-slate-700/60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200">
                        {channel.name}
                      </span>
                    </div>

                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        channel.connected
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400"
                      }`}
                    >
                      {channel.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel de Rendimiento / Insights de IA (Placeholder alineado a docs/frontend.md) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-[#083A3D] dark:text-white">
                Insights Estratégicos con IA
              </h2>
              <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 px-2.5 py-1 rounded-full">
                Vista previa
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
              Análisis predictivo omnicanal generado para optimizar el alcance ·{" "}
              <Link
                href="/dashboard/analytics"
                className="font-medium text-[#2d79f3] hover:underline"
              >
                abrir informes reales
              </Link>
            </p>

            <div className="space-y-3.5">
              <div className="p-4 rounded-2xl bg-gray-50/90 dark:bg-[#2c364d]/60 border border-gray-100 dark:border-slate-700/60">
                <span className="text-xs font-semibold text-[#083A3D] dark:text-emerald-400 block mb-1">
                  💡 Mejor momento de publicación
                </span>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  Las publicaciones realizadas en Instagram y Facebook los
                  martes y jueves entre las 11:00 AM y 1:00 PM han obtenido un
                  28% más de interacción en el sector.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50/90 dark:bg-[#2c364d]/60 border border-gray-100 dark:border-slate-700/60">
                <span className="text-xs font-semibold text-[#083A3D] dark:text-emerald-400 block mb-1">
                  📈 Formato destacado
                </span>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  El contenido con imágenes de productos y descripciones
                  concisas aumentó el CTR en un 18.4% respecto al mes anterior.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
