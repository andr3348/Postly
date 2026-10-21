import { apiJson } from "@/lib/api";
import type { Publication } from "@/features/publications/api";

export type AiGenerationMode = "IDEAS" | "COPY" | "IMPROVE";
export type AiGenerationPlatform = "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" | "TIKTOK";
export type AiGenerationFormat = "FEED" | "REEL";
export type AiGenerationMediaType = "IMAGE" | "VIDEO";

export interface GeneratedIdea {
  readonly title: string;
  readonly angle: string;
  readonly hook: string;
  readonly whyItWorks: string;
  readonly suggestedFormat: string;
}

export interface GeneratedVariant {
  readonly title: string;
  readonly copy: string;
  readonly hashtags: string[];
  readonly cta: string;
  readonly mediaPrompt: string;
  readonly altText: string;
}

export interface GenerateTextPayload {
  readonly brandId: string;
  readonly mode: AiGenerationMode;
  readonly prompt?: string;
  readonly platform?: AiGenerationPlatform;
  readonly format?: AiGenerationFormat;
  readonly mediaType?: AiGenerationMediaType;
  readonly excludeIdeas?: string[];
  readonly currentCopy?: string;
  readonly feedback?: string;
}

export interface GenerateTextResponse {
  readonly model: string;
  readonly tokensUsed: number | null;
  readonly ideas: GeneratedIdea[];
  readonly variants: GeneratedVariant[];
}

export interface GenerateAgentPayload {
  readonly brandId: string;
  readonly prompt: string;
  readonly platform: AiGenerationPlatform;
  readonly format: AiGenerationFormat;
  readonly mediaType?: AiGenerationMediaType;
}

/** Texto generado en el servidor; no persiste nada hasta crear el borrador. */
export function generateText(payload: GenerateTextPayload): Promise<GenerateTextResponse> {
  return apiJson<GenerateTextResponse>("/v1/generations/text", {
    method: "POST",
    data: payload,
  });
}

/**
 * Modo agente: el backend genera texto y media, copia la media a R2 y crea el
 * borrador en el mismo request. Devuelve la publicación creada (DRAFT).
 */
export function generateAgent(payload: GenerateAgentPayload): Promise<Publication> {
  return apiJson<Publication>("/v1/generations/agent", {
    method: "POST",
    data: payload,
  });
}
