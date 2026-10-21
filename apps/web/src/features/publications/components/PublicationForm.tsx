"use client";

import { useState } from "react";
import {
  createPublicationFormSchema,
  publicationMediaSchema,
  type CreatePublicationFormInput,
  type PublicationMedia,
  updateDraftFormSchema,
  type UpdateDraftFormInput,
} from "@/features/publications/schemas";

export interface PublicationFormFill {
  /** Texto que reemplaza el campo de copy (incluye hashtags si aplica). */
  readonly copy: string;
  /** Título sugerido por la IA (las variantes ahora lo traen). */
  readonly title?: string;
  /** Brief con el que se generó, para dejarlo como contexto. */
  readonly originalPrompt?: string;
  /** Modelo real que generó el texto; no se muestra, solo se audita al guardar. */
  readonly modelText?: string;
  /** Cambia en cada uso para que el formulario aplique el nuevo texto. */
  readonly nonce: number;
}

interface PublicationFormProps {
  /** `create` parsea con `createPublicationFormSchema`; `edit` con `updateDraftFormSchema`. */
  readonly mode: "create" | "edit";
  /** Solo se usa al crear: va en el parse y falla si está vacío. */
  readonly brandId?: string;
  readonly initial?: Partial<Pick<CreatePublicationFormInput, "originalPrompt" | "title" | "copy" | "mediaUrl" | "mediaType">>;
  /** Prellenado externo (por ejemplo, desde el asistente IA). */
  readonly fill?: PublicationFormFill;
  readonly submitLabel: string;
  /** El caller hace la mutación (y la invalidación del caché). */
  readonly onSubmit: (data: CreatePublicationFormInput | UpdateDraftFormInput) => Promise<unknown>;
  readonly onCancel?: () => void;
}

/** Formulario de publicación (crear borrador o editar borrador según `mode`). */
export function PublicationForm({
  mode,
  initial,
  fill,
  submitLabel,
  onSubmit,
  onCancel,
  brandId,
}: PublicationFormProps) {
  const [originalPrompt, setOriginalPrompt] = useState(initial?.originalPrompt ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [copy, setCopy] = useState(initial?.copy ?? "");
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl ?? "");
  // El backend fuerza mediaUrl y defaultea mediaType a IMAGE; la UI lo refleja.
  const [mediaType, setMediaType] = useState<PublicationMedia>(initial?.mediaType ?? "IMAGE");
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [modelText, setModelText] = useState<string | undefined>(undefined);
  const [appliedFillNonce, setAppliedFillNonce] = useState<number | undefined>(undefined);

  // Ajuste de estado al cambiar una prop (patrón de React, sin useEffect):
  // reemplaza copy, título y contexto; mediaUrl y mediaType no se tocan.
  if (fill !== undefined && fill.nonce !== appliedFillNonce) {
    setAppliedFillNonce(fill.nonce);
    setCopy(fill.copy);
    setModelText(fill.modelText);
    if (fill.title !== undefined) {
      setTitle(fill.title);
    }
    if (fill.originalPrompt !== undefined) {
      setOriginalPrompt(fill.originalPrompt);
    }
  }

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const draftValues = {
      originalPrompt: emptyToUndefined(originalPrompt),
      // Vacío → `null` en el schema: en edición, borra el título guardado.
      title: title,
      copy: copy,
      mediaUrl: emptyToUndefined(mediaUrl),
      mediaType: mediaType,
      modelText: modelText,
    };
    const parsed =
      mode === "create"
        ? createPublicationFormSchema.safeParse({
            brandId: brandId ?? "",
            ...draftValues,
          })
        : updateDraftFormSchema.safeParse(draftValues);

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
      <Field label="Título (opcional)">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título breve para identificar la publicación…"
          maxLength={200}
          className={inputClass}
        />
      </Field>
      <Field label="Descripción">
        <textarea
          value={copy}
          onChange={(e) => setCopy(e.target.value)}
          placeholder="Escribe la descripción que se publicará…"
          rows={4}
          required
          className={areaClass}
        />
      </Field>
      <Field label="Prompt original (contexto IA, opcional)">
        <textarea
          value={originalPrompt}
          onChange={(e) => setOriginalPrompt(e.target.value)}
          placeholder="Indicación con la que se generó el contenido…"
          rows={2}
          className={areaClass}
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
        <Field label="Media (URL)">
          <input
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="https://…"
            className={inputClass}
          />
        </Field>
        <Field label="Tipo de media">
          <select
            value={mediaType}
            onChange={(e) => {
              const parsed = publicationMediaSchema.safeParse(e.target.value);
              if (parsed.success) setMediaType(parsed.data);
            }}
            className={inputClass}
          >
            <option value="IMAGE">Imagen</option>
            <option value="VIDEO">Video</option>
          </select>
        </Field>
      </div>
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
