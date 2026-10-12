import type { ReactNode } from "react";
import { DashboardShell } from "@/features/dashboard/components/DashboardShell";

/** Cascarón autenticado (cookies + datos por usuario): siempre dinámico. */
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
