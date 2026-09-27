/**
 * Entidad de dominio `Publication`.
 *
 * Tipo puro: sin Prisma, Nest ni librerías. El estado modela el
 * human-in-the-loop: DRAFT → PENDING_APPROVAL → SCHEDULED (→ n8n).
 */
export type PublicationStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'SCHEDULED'
  | 'PROCESSING'
  | 'PUBLISHED'
  | 'PARTIAL'
  | 'FAILED';

export type PublicationMediaType = 'IMAGE' | 'VIDEO';

export interface Publication {
  readonly id: string;
  readonly brandId: string;
  readonly userId: string;
  readonly approvedById: string | null;
  readonly approvedAt: Date | null;
  readonly originalPrompt: string;
  readonly systemPrompt: string | null;
  readonly modelText: string;
  readonly modelMedia: string | null;
  readonly tokensUsed: number | null;
  readonly copy: string;
  readonly mediaUrl: string;
  readonly mediaType: PublicationMediaType;
  readonly status: PublicationStatus;
  readonly scheduledAt: Date | null;
  readonly dispatchedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Quién ejecuta la acción (viene de `@CurrentUser`). */
export interface Requester {
  readonly id: string;
  readonly role: string;
}

/** Transiciones permitidas por la API (PROCESSING+ las mueve n8n, no el dashboard). */
const ALLOWED_TRANSITIONS: Readonly<Record<PublicationStatus, readonly PublicationStatus[]>> = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['SCHEDULED', 'DRAFT'],
  SCHEDULED: [],
  PROCESSING: [],
  PUBLISHED: [],
  PARTIAL: [],
  FAILED: [],
};

export function canTransition(from: PublicationStatus, to: PublicationStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isAdmin(requester: Requester): boolean {
  return requester.role === 'ADMIN';
}

export function isOwner(publication: Publication, requester: Requester): boolean {
  return publication.userId === requester.id;
}
