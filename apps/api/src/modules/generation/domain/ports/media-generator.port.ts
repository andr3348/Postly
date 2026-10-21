import type { GenerationMediaType } from '../generated-content.entity.js';

/** Entrada puramente de dominio para el generador de media. */
export interface MediaGenerationInput {
  readonly prompt: string;
  readonly mediaType: GenerationMediaType;
  /** Relación de aspecto esperada por la red (`9:16` Reel, `1:1` Feed). */
  readonly aspectRatio: string;
}

export interface GeneratedMedia {
  /** URL del proveedor; el almacenamiento propio la descarga después. */
  readonly url: string;
  /** Id real del proveedor (se audita como `modelMedia`). */
  readonly model: string;
  readonly contentType: string;
}

/**
 * Puerto de generación de media (imagen o video). El caso de uso del agente
 * no conoce fal.ai: solo pide una media y recibe dónde encontrarla.
 */
export interface MediaGenerator {
  generate(input: MediaGenerationInput): Promise<GeneratedMedia>;
}

export const MEDIA_GENERATOR: unique symbol = Symbol('MediaGenerator');
