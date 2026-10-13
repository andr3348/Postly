"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface BrandContextValue {
  /** Marca actual (null = sin selección: las vistas usan la primera disponible). */
  readonly selectedId: string | null;
  select(id: string): void;
}

const BrandContext = createContext<BrandContextValue | undefined>(undefined);

const STORAGE_KEY = "postly-brand";

/** Lee la selección persistida sin efectos (init perezoso). */
function initialSelectedId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);

  const select = (id: string) => {
    setSelectedId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Sin almacenamiento disponible.
    }
  };

  return (
    <BrandContext.Provider value={{ selectedId, select }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand(): BrandContextValue {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error("useBrand fuera de BrandProvider");
  }
  return context;
}
