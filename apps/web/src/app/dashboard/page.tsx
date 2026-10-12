import { DashboardHome } from "@/features/dashboard/components/DashboardHome";

/** Contenido por usuario (cookies): jamás prerenderizado como estático. */
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return <DashboardHome />;
}
