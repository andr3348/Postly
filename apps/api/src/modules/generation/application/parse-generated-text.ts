import { z } from 'zod';
import { AiGenerationInvalidResponseError } from '../../../shared/errors.js';
import type {
  GeneratedContent,
  GenerationMode,
} from '../domain/generated-content.entity.js';

const ideaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  angle: z.string().trim().min(1).max(600),
  hook: z.string().trim().min(1).max(600),
  whyItWorks: z.string().trim().min(1).max(800),
  suggestedFormat: z.string().trim().max(50).default('FEED'),
});

const variantSchema = z.object({
  title: z.string().trim().min(1).max(200),
  copy: z.string().trim().min(1).max(10000),
  hashtags: z.array(z.string().trim().max(100)).max(30).default([]),
  cta: z.string().trim().max(800).default(''),
  mediaPrompt: z.string().trim().max(2000).default(''),
  altText: z.string().trim().max(1000).default(''),
});

const ideasResponseSchema = z.object({
  ideas: z.array(ideaSchema).min(1).max(5),
});

const variantsResponseSchema = z.object({
  variants: z.array(variantSchema).min(1).max(5),
});

/** Parsea y valida el JSON que devuelve Gemini. */
export function parseGeneratedText(
  mode: GenerationMode,
  text: string,
  model?: string,
): GeneratedContent {
  const json = extractJson(text, model);

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw invalidResponse('no era JSON válido', model);
  }

  if (mode === 'IDEAS') {
    const result = ideasResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw invalidResponse('no contenía ideas válidas', model);
    }
    return { ideas: result.data.ideas };
  }

  const result = variantsResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw invalidResponse('no contenía variantes válidas', model);
  }
  return { variants: result.data.variants };
}

function extractJson(text: string, model?: string): string {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw invalidResponse('no contenía un objeto JSON', model);
  }
  return candidate.slice(start, end + 1);
}

function invalidResponse(
  detail: string,
  model?: string,
): AiGenerationInvalidResponseError {
  return new AiGenerationInvalidResponseError({
    code: 'GEMINI_INVALID_RESPONSE',
    message: `Gemini devolvió una respuesta inválida: ${detail}. Vuelve a intentarlo.`,
    retryable: true,
    model,
  });
}
