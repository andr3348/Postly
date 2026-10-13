"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "postly-theme";

/** Lee el tema real del navegador (solo se llama en cliente). */
function readTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    // Modo privado sin localStorage: respeta el render del servidor.
    return "light";
  }
}

// Mini-store externo: única fuente de verdad tras hidratar.
let cached: Theme | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): Theme {
  if (cached === null) cached = readTheme();
  return cached;
}

/**
 * El servidor siempre pinta "light". Si el cliente resuelve "dark",
 * React re-renderiza este subárbol en cliente por diseño del hook
 * (sin error de hidratación: para eso existe getServerSnapshot).
 */
function getServerSnapshot(): Theme {
  return "light";
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const invalidate = () => {
    cached = null;
    onChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) invalidate();
  };
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", invalidate);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", invalidate);
  };
}

function publish(next: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Sin almacenamiento: el tema vive solo en memoria en esta sesión.
  }
  document.documentElement.classList.toggle("dark", next === "dark");
  cached = next;
  listeners.forEach((notify) => notify());
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggleTheme = useCallback(() => {
    publish(theme === "light" ? "dark" : "light");
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      theme: "light" as Theme,
      toggleTheme: () => {},
    };
  }
  return context;
}
