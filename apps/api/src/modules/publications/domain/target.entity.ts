/**
 * Destino omnicanal de una publicación (entidad hija, sin módulo propio:
 * no tiene endpoints dedicados, vive anidada bajo `/publications/:id/targets`).
 */
import type { PublicationMediaType } from './publication.entity.js';

export type TargetPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'TIKTOK';

export type TargetStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

/** Cómo se publica el contenido en un canal: feed normal o Reel vertical. */
export type TargetFormat = 'FEED' | 'REEL';

export interface PublicationTarget {
  readonly id: string;
  readonly publicationId: string;
  readonly platform: TargetPlatform;
  readonly format: TargetFormat;
  readonly status: TargetStatus;
  readonly externalPostId: string | null;
  readonly externalPostUrl: string | null;
  readonly errorMessage: string | null;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Plataformas donde el formato Reel está soportado por el flujo actual. */
export function isReelPlatform(platform: TargetPlatform): boolean {
  return platform === 'FACEBOOK' || platform === 'INSTAGRAM';
}

/**
 * Formato por defecto al adjuntar un canal: los videos de Facebook/Instagram
 * se publican como Reel salvo que el cliente pida Feed explícitamente.
 */
export function defaultTargetFormat(
  mediaType: PublicationMediaType,
  platform: TargetPlatform,
): TargetFormat {
  return mediaType === 'VIDEO' && isReelPlatform(platform) ? 'REEL' : 'FEED';
}

/** FEED siempre es válido; REEL exige video y una plataforma soportada. */
export function isTargetFormatValid(
  mediaType: PublicationMediaType,
  platform: TargetPlatform,
  format: TargetFormat,
): boolean {
  return format === 'FEED' || (mediaType === 'VIDEO' && isReelPlatform(platform));
}
