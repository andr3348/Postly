/**
 * Entidad de dominio `Brand`.
 *
 * Tipo puro: no importa nada de Prisma, Nest ni ninguna librería.
 */
export interface Brand {
  readonly id: string;
  readonly name: string;
  readonly logoUrl: string | null;
  readonly websiteUrl: string | null;
  readonly aiTone: string;
  readonly aiBrandVoice: string | null;
  readonly aiTargetAudience: string | null;
  readonly defaultHashtags: string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
