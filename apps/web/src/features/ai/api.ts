import { apiJson } from "@/lib/api";

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

/** Texto generado en el servidor; no persiste nada hasta crear el borrador. */
export function generateText(payload: GenerateTextPayload): Promise<GenerateTextResponse> {
  return apiJson<GenerateTextResponse>("/v1/generations/text", {
    method: "POST",
    data: payload,
  });
}
