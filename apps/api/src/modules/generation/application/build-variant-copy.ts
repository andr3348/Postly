import type { GenerationVariant } from '../domain/generated-content.entity.js';

/**
 * Une copy + hashtags con la misma regla que el panel web: el texto primero y
 * los hashtags separados por una línea en blanco. Normaliza el `#` para que
 * Gemini no pueda "olvidarlo".
 */
export function buildVariantCopy(variant: GenerationVariant): string {
  const hashtags = variant.hashtags
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '')
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
    .join(' ');

  return [variant.copy.trim(), hashtags]
    .filter((part) => part !== '')
    .join('\n\n');
}
