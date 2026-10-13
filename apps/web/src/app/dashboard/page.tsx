import { DashboardHomeLoader } from "@/features/dashboard/components/DashboardHomeLoader";

/** Contenido por usuario (cookies): jamás prerenderizado como estático. */
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return <DashboardHomeLoader />;
}
