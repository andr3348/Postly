/**
 * Destino omnicanal de una publicación (entidad hija, sin módulo propio:
 * no tiene endpoints dedicados, vive anidada bajo `/publications/:id/targets`).
 */
export type TargetPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'TIKTOK';

export type TargetStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface PublicationTarget {
  readonly id: string;
  readonly publicationId: string;
  readonly platform: TargetPlatform;
  readonly status: TargetStatus;
  readonly externalPostId: string | null;
  readonly externalPostUrl: string | null;
  readonly errorMessage: string | null;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
