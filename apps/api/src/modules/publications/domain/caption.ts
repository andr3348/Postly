/**
 * Texto único por red: varias APIs (Facebook, Instagram) no tienen parámetro
 * de título, así que el despacho fusiona `title` + `copy` antes de entregar el
 * claim. El workflow recibe la caption ya compuesta y solo publica.
 */
import type { Publication } from './publication.entity.js';
import type { TargetPlatform } from './target.entity.js';

/**
 * Plataformas cuyo API solo acepta un campo de texto (sin título propio).
 * `Record` exhaustivo a propósito: al sumar una red con título nativo
 * (p. ej. YouTube) se marca aquí y su rama usa `publication.title` aparte.
 */
const MERGES_TITLE_INTO_CAPTION: Readonly<Record<TargetPlatform, boolean>> = {
  FACEBOOK: true,
  INSTAGRAM: true,
  LINKEDIN: true,
  TIKTOK: true,
};

/** Separación visual entre encabezado y cuerpo dentro de la caption. */
const TITLE_SEPARATOR = '\n\n';

/**
 * Caption que espera la API del destino: título opcional (encabezado del
 * dashboard) + `copy`, separados por una línea en blanco. Sin título (o solo
 * espacios) devuelve `copy` intacto.
 */
export function composeCaption(
  source: Pick<Publication, 'title' | 'copy'>,
  platform: TargetPlatform,
): string {
  const title = source.title?.trim() ?? '';
  if (!MERGES_TITLE_INTO_CAPTION[platform] || title === '') {
    return source.copy;
  }
  return `${title}${TITLE_SEPARATOR}${source.copy}`;
}
