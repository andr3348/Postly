import { Prisma } from '@postly/database';
import type { TargetMetric } from '../domain/metric.entity.js';
import type {
  Publication,
  PublicationMediaType,
  PublicationStatus,
} from '../domain/publication.entity.js';
import type {
  PublicationTarget,
  TargetFailure,
  TargetFormat,
  TargetPlatform,
  TargetStatus,
} from '../domain/target.entity.js';

export interface PublicationRow {
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
  readonly mediaType: string;
  readonly status: string;
  readonly scheduledAt: Date | null;
  readonly dispatchedAt: Date | null;
  readonly dispatchAttemptId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TargetRow {
  readonly id: string;
  readonly publicationId: string;
  readonly platform: string;
  readonly format: string;
  readonly status: string;
  readonly externalPostId: string | null;
  readonly externalPostUrl: string | null;
  readonly errorMessage: string | null;
  readonly failure: unknown;
  readonly retryCount: number;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface MetricRow {
  readonly id: string;
  readonly publicationTargetId: string;
  readonly impressions: number;
  readonly likes: number;
  readonly comments: number;
  readonly shares: number;
  readonly clicks: number;
  readonly capturedAt: Date;
}

export function toDomainPublication(row: PublicationRow): Publication {
  return {
    id: row.id,
    brandId: row.brandId,
    userId: row.userId,
    approvedById: row.approvedById,
    approvedAt: row.approvedAt,
    originalPrompt: row.originalPrompt,
    systemPrompt: row.systemPrompt,
    modelText: row.modelText,
    modelMedia: row.modelMedia,
    tokensUsed: row.tokensUsed,
    copy: row.copy,
    mediaUrl: row.mediaUrl,
    mediaType: toDomainMediaType(row.mediaType),
    status: toDomainStatus(row.status),
    scheduledAt: row.scheduledAt,
    dispatchedAt: row.dispatchedAt,
    dispatchAttemptId: row.dispatchAttemptId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toDomainTarget(row: TargetRow): PublicationTarget {
  return {
    id: row.id,
    publicationId: row.publicationId,
    platform: toDomainPlatform(row.platform),
    format: toDomainFormat(row.format),
    status: toDomainTargetStatus(row.status),
    externalPostId: row.externalPostId,
    externalPostUrl: row.externalPostUrl,
    errorMessage: row.errorMessage,
    failure: toDomainFailure(row.failure),
    retryCount: row.retryCount,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toDomainMetric(row: MetricRow): TargetMetric {
  return {
    id: row.id,
    publicationTargetId: row.publicationTargetId,
    impressions: row.impressions,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    clicks: row.clicks,
    capturedAt: row.capturedAt,
  };
}

function toDomainFailure(value: unknown): TargetFailure | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value['kind'] !== 'string' ||
    typeof value['stage'] !== 'string' ||
    typeof value['message'] !== 'string' ||
    typeof value['action'] !== 'string'
  ) {
    return null;
  }
  return value as unknown as TargetFailure;
}

/** `undefined` no toca el campo; `null` guarda SQL NULL (no JSON null). */
export function toPrismaFailure(
  failure: TargetFailure | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (failure === undefined) {
    return undefined;
  }
  return failure === null ? Prisma.DbNull : (failure as unknown as Prisma.InputJsonValue);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toDomainMediaType(value: string): PublicationMediaType {
  if (value === 'IMAGE' || value === 'VIDEO') {
    return value;
  }
  throw new Error(`[publications] Unknown mediaType in database: ${value}`);
}

function toDomainStatus(value: string): PublicationStatus {
  switch (value) {
    case 'DRAFT':
    case 'PENDING_APPROVAL':
    case 'SCHEDULED':
    case 'PROCESSING':
    case 'PUBLISHED':
    case 'PARTIAL':
    case 'FAILED':
      return value;
    default:
      throw new Error(`[publications] Unknown status in database: ${value}`);
  }
}

function toDomainPlatform(value: string): TargetPlatform {
  if (value === 'FACEBOOK' || value === 'INSTAGRAM' || value === 'LINKEDIN' || value === 'TIKTOK') {
    return value;
  }
  throw new Error(`[publications] Unknown platform in database: ${value}`);
}

function toDomainTargetStatus(value: string): TargetStatus {
  if (value === 'PENDING' || value === 'SUCCESS' || value === 'FAILED') {
    return value;
  }
  throw new Error(`[publications] Unknown target status in database: ${value}`);
}

function toDomainFormat(value: string): TargetFormat {
  if (value === 'FEED' || value === 'REEL') {
    return value;
  }
  throw new Error(`[publications] Unknown target format in database: ${value}`);
}
