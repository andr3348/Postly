import type { GenerationMode } from '../generated-content.entity.js';

/**
 * Entrada mínima del puerto. El adaptador no conoce marcas ni HTTP:
 * recibe prompts ya armados y devuelve texto + metadatos.
 */
export interface LlmTextGeneratorInput {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly mode: GenerationMode;
}

export interface LlmTextGeneratorResult {
  readonly model: string;
  readonly text: string;
  readonly tokensUsed: number | null;
}

export interface LlmTextGenerator {
  generate(input: LlmTextGeneratorInput): Promise<LlmTextGeneratorResult>;
}

export const LLM_TEXT_GENERATOR: unique symbol = Symbol('LlmTextGenerator');
