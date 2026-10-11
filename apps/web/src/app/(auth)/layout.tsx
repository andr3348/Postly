"use client";

import { ReactNode, useEffect, useState } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Check saved theme or system preference
    const savedTheme = localStorage.getItem("postly-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("postly-theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#e9edf2] dark:bg-[#151922] p-4 font-sans transition-colors duration-300">
      {/* Botón flotante para alternar Modo Claro / Oscuro */}
      <div className="fixed top-4 right-4 z-50">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Alternar modo claro y oscuro"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium border shadow-sm backdrop-blur-md transition-all duration-200 cursor-pointer bg-white/90 border-gray-200 text-gray-700 hover:bg-white hover:shadow dark:bg-[#232a3e]/90 dark:border-[#384460] dark:text-gray-200 dark:hover:bg-[#232a3e]"
        >
          {theme === "dark" ? (
            <>
              {/* Icono Sol */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4 text-amber-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
              <span>Modo Claro</span>
            </>
          ) : (
            <>
              {/* Icono Luna */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4 text-slate-700"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
              <span>Modo Oscuro</span>
            </>
          )}
        </button>
      </div>

      {children}
    </div>
  );
}
