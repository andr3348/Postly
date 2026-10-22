"use client";

import { useState } from "react";
import type { MetaOAuthSession } from "@/features/connected-accounts/api";

interface MetaPagePickerProps {
  readonly session: MetaOAuthSession;
  onSubmit(pageId: string): Promise<void>;
  readonly onCancel: () => void;
}

/**
 * Selector de página tras volver del diálogo de Meta.
 * Solo muestra nombres/IDs e IG vinculado: los Page tokens nunca llegan aquí.
 */
export function MetaPagePicker({ session, onSubmit, onCancel }: MetaPagePickerProps) {
  const [selectedId, setSelectedId] = useState(session.pages[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (event: React.SubmitEvent) => {
    event.preventDefault();
    if (selectedId === "") {
      setErrorMsg("Elige una página para continuar");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    try {
      await onSubmit(selectedId);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo guardar la conexión");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-[#2d374e] rounded-[10px] px-3 py-2">
        Elige la página que publicará. Las cuentas de Meta deben estar
        conectadas: Instagram se habilita después desde su tarjeta.
      </p>
      {errorMsg !== "" && (
        <p className="text-red-500 text-sm text-center font-medium">{errorMsg}</p>
      )}

      <div className="flex flex-col gap-2">
        {session.pages.map((page) => {
          const selected = selectedId === page.id;
          return (
            <label
              key={page.id}
              className={`flex items-start gap-3 border rounded-[12px] px-3 py-3 cursor-pointer transition-colors ${
                selected
                  ? "border-[#2d79f3] bg-blue-50/60 dark:bg-blue-950/30"
                  : "border-[#ecedec] dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-[#2d374e]"
              }`}
            >
              <input
                type="radio"
                name="meta-page"
                value={page.id}
                checked={selected}
                onChange={() => setSelectedId(page.id)}
                className="mt-0.5 accent-[#2d79f3]"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-[#151717] dark:text-white truncate">
                  {page.name}
                </span>
                <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                  {page.id}
                </span>
                <span className="block text-[11px] mt-0.5 text-gray-500 dark:text-gray-400">
                  {page.instagram
                    ? `Instagram: @${page.instagram.username}`
                    : "Sin Instagram vinculado"}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex gap-2.5 mt-1">
        <button
          type="submit"
          disabled={saving || session.pages.length === 0}
          className="bg-[#151717] text-white text-sm font-medium rounded-[10px] px-6 h-[44px] cursor-pointer hover:bg-[#252727] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Guardando…" : "Guardar conexión"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium rounded-[10px] px-6 h-[44px] cursor-pointer text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#2d374e] transition-colors duration-200"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
