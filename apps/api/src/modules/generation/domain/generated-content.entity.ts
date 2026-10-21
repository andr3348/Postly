/** Modos soportados por el asistente de texto. */
export type GenerationMode = 'IDEAS' | 'COPY' | 'IMPROVE';

export type GenerationPlatform =
  'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'TIKTOK';

export type GenerationFormat = 'FEED' | 'REEL';

export type GenerationMediaType = 'IMAGE' | 'VIDEO';

export interface GenerationIdea {
  readonly title: string;
  readonly angle: string;
  readonly hook: string;
  readonly whyItWorks: string;
  readonly suggestedFormat: string;
}

export interface GenerationVariant {
  readonly title: string;
  readonly copy: string;
  readonly hashtags: string[];
  readonly cta: string;
  readonly mediaPrompt: string;
  readonly altText: string;
}

/** Contenido ya parseado; el modo decide cuál de los dos arreglos viene. */
export interface GeneratedContent {
  readonly ideas?: GenerationIdea[];
  readonly variants?: GenerationVariant[];
}

/** Entrada puramente de dominio para el caso de uso de texto. */
export interface GenerateTextInput {
  readonly brandId: string;
  readonly mode: GenerationMode;
  readonly prompt?: string;
  readonly platform?: GenerationPlatform;
  readonly format?: GenerationFormat;
  readonly mediaType?: GenerationMediaType;
  readonly excludeIdeas?: readonly string[];
  readonly currentCopy?: string;
  readonly feedback?: string;
}

/** Resultado ya validado que consume el controller. */
export interface GenerateTextResult {
  readonly model: string;
  readonly tokensUsed: number | null;
  readonly ideas: GenerationIdea[];
  readonly variants: GenerationVariant[];
}
