"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/components/ui/chart";
import { getBrandsCached } from "@/features/brands/api";
import { useBrand } from "@/features/brands/BrandContext";
import {
  getAnalyticsSummaryCached,
  type AnalyticsSummary,
} from "@/features/analytics/api";

/**
 * Vista Informes: agregados reales de publications (solo lectura).
 * Regla espejo del backend: por destino solo cuenta su snapshot más
 * reciente de métricas (sumar el historial duplicaría impresiones).
 */

const numberFmt = new Intl.NumberFormat("es");

/** Orden del flujo real (publ.): el pipeline completo, con etiquetas ES. */
const STATUS_ORDER: ReadonlyArray<{ readonly value: string; readonly label: string }> = [
  { value: "DRAFT", label: "Borradores" },
  { value: "PENDING_APPROVAL", label: "Por aprobar" },
  { value: "SCHEDULED", label: "Programadas" },
  { value: "PROCESSING", label: "En proceso" },
  { value: "PUBLISHED", label: "Publicadas" },
  { value: "PARTIAL", label: "Parciales" },
  { value: "FAILED", label: "Fallidas" },
];

const PLATFORM_LABEL: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  TIKTOK: "TikTok",
};

const platformLabel = (platform: string): string => PLATFORM_LABEL[platform] ?? platform;

export function AnalyticsView() {
  return (
    <Suspense fallback={<Panel text="Cargando informes…" />}>
      <AnalyticsInner />
    </Suspense>
  );
}

function AnalyticsInner() {
  const { brands } = use(getBrandsCached());
  const { selectedId } = useBrand();
  const current = brands.find((brand) => brand.id === selectedId) ?? brands[0] ?? null;

  if (current === null) {
    return (
      <Panel>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Sin marcas todavía.{" "}
          <Link href="/dashboard/brands" className="font-medium text-[#2d79f3] hover:underline">
            Crea una marca
          </Link>{" "}
          para ver informes de su contenido.
        </p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-[#083A3D] dark:text-white">
          Informes
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Marca: {current.name} · agregados de publicaciones y métricas (solo lectura)
        </p>
      </div>

      <Suspense fallback={<Panel text="Cargando métricas…" />}>
        <SummaryContent brandId={current.id} />
      </Suspense>
    </div>
  );
}

function SummaryContent({ brandId }: { brandId: string }) {
  const summary = use(getAnalyticsSummaryCached(brandId, 0));

  if (summary.totalPublications === 0) {
    return (
      <Panel>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Esta marca no tiene publicaciones aún, así que no hay métricas que
          agregar.{" "}
          <Link
            href="/dashboard/publications/new"
            className="font-medium text-[#2d79f3] hover:underline"
          >
            Crea la primera
          </Link>
          .
        </p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Publicaciones" value={numberFmt.format(summary.totalPublications)} hint="histórico de la marca" />
        <KpiCard label="Impresiones" value={numberFmt.format(summary.totalImpressions)} hint="último registro por destino" />
        <KpiCard label="Interacciones" value={numberFmt.format(summary.totalInteractions)} hint="likes + comentarios + shares" />
        <KpiCard label="Engagement" value={`${summary.engagementRate.toFixed(2)}%`} hint="interacciones / impresiones" />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <StatusChartCard byStatus={summary.byStatus} />
        <PlatformChartCard summary={summary} />
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="rounded-3xl border-gray-100 dark:border-[#2d374e] shadow-xs bg-white dark:bg-[#232a3e] gap-3 py-5">
      <CardHeader className="px-5">
        <CardDescription className="text-xs font-medium">{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums text-[#083A3D] dark:text-white">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5">
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>
      </CardContent>
    </Card>
  );
}

const statusChartConfig = {
  count: { label: "Publicaciones", color: "var(--chart-1)" },
} satisfies ChartConfig;

function StatusChartCard({ byStatus }: { byStatus: Record<string, number> }) {
  const data = STATUS_ORDER.map((status) => ({
    label: status.label,
    count: byStatus[status.value] ?? 0,
  })).filter((row) => row.count > 0);

  return (
    <Card className="rounded-3xl border-gray-100 dark:border-[#2d374e] shadow-xs bg-white dark:bg-[#232a3e]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#083A3D] dark:text-white">
          Publicaciones por estado
        </CardTitle>
        <CardDescription className="text-xs">
          dónde está cada pieza del flujo de aprobación
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {data.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 py-8 text-center">
            Sin estados registrados todavía.
          </p>
        ) : (
          <ChartContainer config={statusChartConfig} className="aspect-auto h-[220px] w-full">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={6} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

const platformChartConfig = {
  impressions: { label: "Impresiones", color: "var(--chart-2)" },
  interactions: { label: "Interacciones", color: "var(--chart-3)" },
} satisfies ChartConfig;

function PlatformChartCard({ summary }: { summary: AnalyticsSummary }) {
  const data = summary.byPlatform.map((entry) => ({
    label: platformLabel(entry.platform),
    impressions: entry.impressions,
    interactions: entry.interactions,
    engagementRate: entry.engagementRate,
  }));

  return (
    <Card className="rounded-3xl border-gray-100 dark:border-[#2d374e] shadow-xs bg-white dark:bg-[#232a3e]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#083A3D] dark:text-white">
          Rendimiento por canal
        </CardTitle>
        <CardDescription className="text-xs">
          por destino solo cuenta su snapshot más reciente de métricas
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5 flex flex-col gap-3">
        {data.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 py-8 text-center">
            Aún no hay destinos con métricas.{" "}
            <Link
              href="/dashboard/publications"
              className="font-medium text-[#2d79f3] hover:underline"
            >
              Regístralas desde el detalle
            </Link>{" "}
            de cada publicación.
          </p>
        ) : (
          <>
            <ChartContainer config={platformChartConfig} className="aspect-auto h-[200px] w-full">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="impressions" fill="var(--color-impressions)" radius={6} />
                <Bar dataKey="interactions" fill="var(--color-interactions)" radius={6} />
              </BarChart>
            </ChartContainer>
            <div className="flex flex-wrap gap-2">
              {data.map((row) => (
                <span
                  key={row.label}
                  className="text-[11px] font-medium rounded-full px-2.5 py-1 bg-gray-50 text-gray-600 dark:bg-[#2c364d]/60 dark:text-gray-300 border border-gray-100 dark:border-slate-700/60"
                >
                  {row.label}: {row.engagementRate.toFixed(2)}% de engagement
                </span>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Panel({ children, text }: { children?: React.ReactNode; text?: string }) {
  return (
    <div className="bg-white dark:bg-[#232a3e] border border-gray-100 dark:border-[#2d374e] rounded-[22px] p-8 shadow-xs text-center">
      {children ?? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{text}</p>
      )}
    </div>
  );
}
