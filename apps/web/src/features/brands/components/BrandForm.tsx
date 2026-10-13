"use client";

import { useState } from "react";
import { brandFormSchema, type BrandFormInput } from "@/features/brands/schemas";

interface BrandFormProps {
  readonly initial?: Partial<BrandFormInput>;
  readonly submitLabel: string;
  readonly onSubmit: (data: BrandFormInput) => Promise<void>;
  readonly onCancel?: () => void;
}

/** Formulario crear/editar marca (estilos del resto del dashboard). */
export function BrandForm({ initial, submitLabel, onSubmit, onCancel }: BrandFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initial?.websiteUrl ?? "");
  const [aiTone, setAiTone] = useState(initial?.aiTone ?? "");
  const [aiBrandVoice, setAiBrandVoice] = useState(initial?.aiBrandVoice ?? "");
  const [aiTargetAudience, setAiTargetAudience] = useState(initial?.aiTargetAudience ?? "");
  const [hashtags, setHashtags] = useState((initial?.defaultHashtags ?? []).join(", "));
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const parsed = brandFormSchema.safeParse({
      name,
      logoUrl: emptyToUndefined(logoUrl),
      websiteUrl: emptyToUndefined(websiteUrl),
      aiTone: emptyToUndefined(aiTone),
      aiBrandVoice: emptyToUndefined(aiBrandVoice),
      aiTargetAudience: emptyToUndefined(aiTargetAudience),
      defaultHashtags: hashtags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ""),
    });
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }

    setSaving(true);
    try {
      await onSubmit(parsed.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {errorMsg !== "" && (
        <p className="text-red-500 text-sm text-center font-medium">{errorMsg}</p>
      )}
      <Field label="Nombre">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Alma Quinta"
          required
          className={inputClass}
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Logo (URL)">
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…"
            className={inputClass}
          />
        </Field>
        <Field label="Sitio web (URL)">
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://…"
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Tono de IA">
        <input
          value={aiTone}
          onChange={(e) => setAiTone(e.target.value)}
          placeholder="Profesional y persuasivo"
          className={inputClass}
        />
      </Field>
      <Field label="Voz de marca (contexto IA)">
        <textarea
          value={aiBrandVoice}
          onChange={(e) => setAiBrandVoice(e.target.value)}
          placeholder="Identidad de la marca…"
          rows={2}
          className={areaClass}
        />
      </Field>
      <Field label="Audiencia objetivo (contexto IA)">
        <textarea
          value={aiTargetAudience}
          onChange={(e) => setAiTargetAudience(e.target.value)}
          placeholder="Segmento al que se dirige…"
          rows={2}
          className={areaClass}
        />
      </Field>
      <Field label="Hashtags (separados por comas)">
        <input
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          placeholder="#Marketing, #Arequipa"
          className={inputClass}
        />
      </Field>
      <div className="flex gap-2.5 mt-1">
        <button
          type="submit"
          disabled={saving}
          className="bg-[#151717] text-white text-sm font-medium rounded-[10px] px-6 h-[44px] cursor-pointer hover:bg-[#252727] transition-colors duration-200 disabled:opacity-50"
        >
          {saving ? "Guardando…" : submitLabel}
        </button>
        {onCancel !== undefined && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium rounded-[10px] px-6 h-[44px] cursor-pointer text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#2d374e] transition-colors duration-200"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[#151717] dark:text-gray-200 font-semibold text-sm">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded-[10px] border-[1.5px] border-[#ecedec] dark:border-slate-700 px-3 h-[46px] focus:outline-none focus:border-[#2d79f3] bg-transparent text-[#151717] dark:text-white text-sm w-full placeholder:text-gray-400 dark:placeholder:text-slate-300/80";

const areaClass =
  "rounded-[10px] border-[1.5px] border-[#ecedec] dark:border-slate-700 px-3 py-2.5 focus:outline-none focus:border-[#2d79f3] bg-transparent text-[#151717] dark:text-white text-sm w-full placeholder:text-gray-400 dark:placeholder:text-slate-300/80";
