"use client";

import { useState } from "react";
import {
  generateText,
  type AiGenerationFormat,
  type AiGenerationMediaType,
  type AiGenerationMode,
  type AiGenerationPlatform,
  type GeneratedIdea,
  type GeneratedVariant,
  type GenerateTextPayload,
} from "@/features/ai/api";
import { ApiError } from "@/lib/api";

interface AiAssistantPanelProps {
  readonly brandId: string | null;
  readonly onUseText: (payload: {
    copy: string;
    originalPrompt: string;
    modelText: string;
  }) => void;
}

type VisibleMode = "IDEAS" | "COPY";

interface RunOptions {
  readonly prompt?: string;
  readonly currentCopy?: string;
  readonly feedback?: string;
}

/** Variante con el modelo real que la generó (puede ser el fallback). */
interface GeneratedVariantWithModel extends GeneratedVariant {
  readonly model: string;
}

interface AiPanelError {
  readonly message: string;
  readonly retryable: boolean;
}

/**
 * Panel de generación de texto. No guarda publicaciones: el botón "Usar este
 * texto" solo prellena el formulario que está debajo.
 */
export function AiAssistantPanel({ brandId, onUseText }: AiAssistantPanelProps) {
  const [mode, setMode] = useState<VisibleMode>("IDEAS");
  const [brief, setBrief] = useState("");
  const [platform, setPlatform] = useState<AiGenerationPlatform | "">("");
  const [format, setFormat] = useState<AiGenerationFormat | "">("");
  const [mediaType, setMediaType] = useState<AiGenerationMediaType | "">("");
  const [ideas, setIdeas] = useState<GeneratedIdea[]>([]);
  const [variants, setVariants] = useState<GeneratedVariantWithModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AiPanelError | null>(null);
  const [retryPayload, setRetryPayload] = useState<GenerateTextPayload | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [improveTarget, setImproveTarget] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const executeGeneration = async (payload: GenerateTextPayload): Promise<void> => {
    setLoading(true);
    setError(null);
    setRetryPayload(null);

    try {
      const response = await generateText(payload);
      setModel(response.model);
      if (payload.mode === "IDEAS") {
        setIdeas((current) => [...current, ...response.ideas]);
      } else {
        setVariants(
          response.variants.map((variant) => ({
            ...variant,
            model: response.model,
          })),
        );
      }
      if (payload.mode === "IMPROVE") {
        setImproveTarget(null);
        setFeedback("");
      }
    } catch (err: unknown) {
      const panelError = toPanelError(err);
      setError(panelError);
      if (panelError.retryable) {
        setRetryPayload(payload);
      }
    } finally {
      setLoading(false);
    }
  };

  const runGeneration = async (
    nextMode: AiGenerationMode,
    options: RunOptions = {},
  ): Promise<void> => {
    if (brandId === null) {
      setError({
        message: "Selecciona una marca en el switcher para usar el asistente.",
        retryable: false,
      });
      return;
    }

    const prompt = (options.prompt ?? brief).trim();
    if (nextMode !== "IMPROVE" && prompt === "") {
      setError({
        message: "Escribe un brief o una idea para empezar.",
        retryable: false,
      });
      return;
    }

    const currentCopy = (options.currentCopy ?? "").trim();
    if (nextMode === "IMPROVE" && currentCopy === "") {
      setError({ message: "No hay texto para mejorar.", retryable: false });
      return;
    }

    const feedbackValue = (options.feedback ?? feedback).trim();
    const request: GenerateTextPayload = {
      brandId,
      mode: nextMode,
      ...(prompt === "" ? {} : { prompt }),
      ...(platform === "" ? {} : { platform }),
      ...(format === "" ? {} : { format }),
      ...(mediaType === "" ? {} : { mediaType }),
      ...(nextMode === "IDEAS"
        ? { excludeIdeas: ideas.slice(-30).map((idea) => idea.title) }
        : {}),
      ...(nextMode === "IMPROVE"
        ? {
            currentCopy,
            ...(feedbackValue === "" ? {} : { feedback: feedbackValue }),
          }
        : {}),
    };

    await executeGeneration(request);
  };

  const handleRetry = (): void => {
    if (retryPayload === null || loading) {
      return;
    }
    void executeGeneration(retryPayload);
  };

  const handleGenerate = (): void => {
    void runGeneration(mode);
  };

  const handleMoreIdeas = (): void => {
    setMode("IDEAS");
    void runGeneration("IDEAS");
  };

  const handleDevelop = (idea: GeneratedIdea): void => {
    const ideaPrompt = [
      brief.trim(),
      "Desarrolla esta idea en un copy listo para revisar:",
      `Título: ${idea.title}`,
      `Ángulo: ${idea.angle}`,
      `Hook: ${idea.hook}`,
    ]
      .filter((part) => part !== "")
      .join("\n\n");

    setBrief(ideaPrompt);
    setMode("COPY");
    void runGeneration("COPY", { prompt: ideaPrompt });
  };

  const handleUseText = (variant: GeneratedVariantWithModel): void => {
    const hashtags = variant.hashtags
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "")
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
      .join(" ");
    const copy = [variant.copy.trim(), hashtags].filter((part) => part !== "").join("\n\n");

    onUseText({
      copy,
      originalPrompt: brief.trim(),
      modelText: variant.model,
    });
  };

  const disabled = loading || brandId === null;

  return (
    <section className="rounded-[22px] border border-[#dce8e6] bg-[#f7fbfa] p-5 dark:border-[#2d374e] dark:bg-[#1d2433]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[#083A3D] dark:text-white">
              Asistente IA
            </h2>
            <span className="rounded-full bg-[#e5f4ef] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#0f766e] dark:bg-[#123a3a] dark:text-[#7dd3c7]">
              Gemini
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Genera ideas o copy con el tono de la marca activa. No se guarda nada
            hasta que crees el borrador.
          </p>
        </div>

        <div className="inline-flex w-fit rounded-full border border-[#dce8e6] bg-white p-1 dark:border-[#2d374e] dark:bg-[#232a3e]">
          <button
            type="button"
            onClick={() => setMode("IDEAS")}
            className={mode === "IDEAS" ? tabActiveClass : tabClass}
          >
            Ideas
          </button>
          <button
            type="button"
            onClick={() => setMode("COPY")}
            className={mode === "COPY" ? tabActiveClass : tabClass}
          >
            Texto
          </button>
        </div>
      </div>

      {brandId === null && (
        <p className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          Selecciona una marca en el switcher para usar el asistente.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-[#151717] dark:text-gray-200">
            {mode === "IDEAS" ? "¿Qué quieres comunicar?" : "Brief o idea a desarrollar"}
          </span>
          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            placeholder={
              mode === "IDEAS"
                ? "Ej. Curso de marketing digital para pymes de Arequipa…"
                : "Ej. Lanzamiento de un curso de marketing para pymes…"
            }
            rows={3}
            maxLength={5000}
            disabled={brandId === null}
            className={areaClass}
          />
        </label>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={platform}
            onChange={(event) => setPlatform(event.target.value as AiGenerationPlatform | "")}
            disabled={brandId === null}
            className={selectClass}
            aria-label="Plataforma"
          >
            <option value="">Plataforma: general</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="LINKEDIN">LinkedIn</option>
            <option value="TIKTOK">TikTok</option>
          </select>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as AiGenerationFormat | "")}
            disabled={brandId === null}
            className={selectClass}
            aria-label="Formato"
          >
            <option value="">Formato: general</option>
            <option value="FEED">Feed</option>
            <option value="REEL">Reel</option>
          </select>
          <select
            value={mediaType}
            onChange={(event) => setMediaType(event.target.value as AiGenerationMediaType | "")}
            disabled={brandId === null}
            className={selectClass}
            aria-label="Tipo de media"
          >
            <option value="">Media: general</option>
            <option value="IMAGE">Imagen</option>
            <option value="VIDEO">Video</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={disabled}
            className={primaryButtonClass}
          >
            {loading
              ? "Generando…"
              : mode === "IDEAS"
                ? "Generar ideas"
                : variants.length > 0
                  ? "Generar otras variantes"
                  : "Generar texto"}
          </button>
          {mode === "IDEAS" && ideas.length > 0 && (
            <button
              type="button"
              onClick={handleMoreIdeas}
              disabled={disabled}
              className={secondaryButtonClass}
            >
              Más ideas
            </button>
          )}
        </div>
      </div>

      {error !== null && (
        <div
          role="alert"
          className="mt-4 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
        >
          <p className="font-semibold">No se pudo generar el contenido</p>
          <p className="mt-1 leading-relaxed">{error.message}</p>
          {error.retryable && retryPayload !== null && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={loading}
              className={`${primaryButtonSmallClass} mt-2`}
            >
              {loading ? "Reintentando…" : "Reintentar"}
            </button>
          )}
        </div>
      )}

      {mode === "IDEAS" && ideas.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          {ideas.map((idea, index) => (
            <article
              key={`${idea.title}-${index}`}
              className="flex flex-col rounded-[16px] border border-[#e3ecea] bg-white p-4 shadow-xs dark:border-[#2d374e] dark:bg-[#232a3e]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#0f766e] dark:text-[#7dd3c7]">
                  Idea {index + 1}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-[#2d374e] dark:text-gray-300">
                  {idea.suggestedFormat}
                </span>
              </div>
              <h3 className="mt-2 text-sm font-semibold leading-snug text-[#151717] dark:text-white">
                {idea.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                {idea.angle}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-[#151717] dark:text-gray-100">Hook: </span>
                {idea.hook}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                  Por qué funciona:{" "}
                </span>
                {idea.whyItWorks}
              </p>
              <button
                type="button"
                onClick={() => handleDevelop(idea)}
                disabled={disabled}
                className={`${secondaryButtonClass} mt-3 w-full`}
              >
                Desarrollar
              </button>
            </article>
          ))}
        </div>
      )}

      {mode === "COPY" && variants.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          {variants.map((variant, index) => (
            <article
              key={`${variant.copy.slice(0, 40)}-${index}`}
              className="rounded-[16px] border border-[#e3ecea] bg-white p-4 shadow-xs dark:border-[#2d374e] dark:bg-[#232a3e]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#0f766e] dark:text-[#7dd3c7]">
                  Variante {index + 1}
                </span>
                {variant.cta !== "" && (
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                    CTA: {variant.cta}
                  </span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#151717] dark:text-gray-100">
                {variant.copy}
              </p>
              {variant.hashtags.length > 0 && (
                <p className="mt-2 text-xs text-[#0f766e] dark:text-[#7dd3c7]">
                  {variant.hashtags.join(" ")}
                </p>
              )}
              {variant.mediaPrompt !== "" && (
                <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  <span className="font-semibold text-gray-700 dark:text-gray-200">Media: </span>
                  {variant.mediaPrompt}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleUseText(variant)}
                  className={primaryButtonSmallClass}
                >
                  Usar este texto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImproveTarget(variant.copy);
                    setFeedback("");
                  }}
                  disabled={disabled}
                  className={secondaryButtonClass}
                >
                  Mejorar
                </button>
              </div>
            </article>
          ))}

          {improveTarget !== null && (
            <div className="rounded-[16px] border border-[#dce8e6] bg-white p-4 dark:border-[#2d374e] dark:bg-[#232a3e]">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-[#151717] dark:text-gray-200">
                  ¿Qué quieres ajustar?
                </span>
                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="Ej. Hazlo más corto y cambia el CTA…"
                  rows={2}
                  maxLength={1000}
                  className={areaClass}
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void runGeneration("IMPROVE", {
                      currentCopy: improveTarget,
                      feedback,
                    })
                  }
                  disabled={disabled}
                  className={primaryButtonSmallClass}
                >
                  Aplicar indicación
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImproveTarget(null);
                    setFeedback("");
                  }}
                  className={secondaryButtonClass}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#e3ecea] pt-3 text-[11px] text-gray-500 dark:border-[#2d374e] dark:text-gray-400">
        <span>Revisa datos y tono. La media se agrega manualmente por ahora.</span>
        {model !== null && <span>Modelo: {model}</span>}
      </div>
    </section>
  );
}

function toPanelError(error: unknown): AiPanelError {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      retryable:
        error.retryable ??
        (error.status === 0 || error.status === 429 || error.status >= 500),
    };
  }
  return {
    message:
      error instanceof Error
        ? error.message
        : "No se pudo generar el texto.",
    retryable: false,
  };
}

const tabClass =
  "rounded-full px-3.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-[#0f766e] dark:text-gray-400 dark:hover:text-[#7dd3c7]";

const tabActiveClass =
  "rounded-full bg-[#083A3D] px-3.5 py-1.5 text-xs font-semibold text-white dark:bg-[#7dd3c7] dark:text-[#083A3D]";

const primaryButtonClass =
  "h-[40px] rounded-[10px] bg-[#083A3D] px-5 text-sm font-medium text-white transition-colors hover:bg-[#0b4b4e] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#7dd3c7] dark:text-[#083A3D] dark:hover:bg-[#a7e8dd]";

const primaryButtonSmallClass =
  "h-[36px] rounded-[10px] bg-[#083A3D] px-4 text-xs font-medium text-white transition-colors hover:bg-[#0b4b4e] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#7dd3c7] dark:text-[#083A3D] dark:hover:bg-[#a7e8dd]";

const secondaryButtonClass =
  "h-[36px] rounded-[10px] border border-[#dce8e6] bg-white px-4 text-xs font-medium text-[#0f766e] transition-colors hover:bg-[#eef8f5] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2d374e] dark:bg-[#232a3e] dark:text-[#7dd3c7] dark:hover:bg-[#2d374e]";

const selectClass =
  "h-[40px] w-full rounded-[10px] border-[1.5px] border-[#ecedec] bg-white px-3 text-xs text-[#151717] focus:border-[#2d79f3] focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-[#232a3e] dark:text-white";

const areaClass =
  "w-full rounded-[10px] border-[1.5px] border-[#ecedec] bg-white px-3 py-2.5 text-sm text-[#151717] placeholder:text-gray-400 focus:border-[#2d79f3] focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-[#232a3e] dark:text-white dark:placeholder:text-slate-300/80";
