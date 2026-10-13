"use client";

import { useState, type ReactNode } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardNavbar } from "./DashboardNavbar";
import { BrandProvider } from "@/features/brands/BrandContext";

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#e9edf2] dark:bg-[#151922] text-gray-900 dark:text-gray-100 flex p-3.5 gap-3.5 transition-colors duration-300 font-sans">
      {/* Sidebar Lateral */}
      <DashboardSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Área Principal de Contenido */}
      <BrandProvider>
        <div className="flex-1 flex flex-col min-w-0 gap-3.5">
          {/* Barra Superior */}
          <DashboardNavbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

          {/* Contenido Inyectado */}
          <main className="flex-1">{children}</main>
        </div>
      </BrandProvider>
    </div>
  );
}
