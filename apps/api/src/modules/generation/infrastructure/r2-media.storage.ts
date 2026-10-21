import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiGenerationUnavailableError } from '../../../shared/errors.js';
import type {
  MediaStorage,
  MediaUploadInput,
} from '../domain/ports/media-storage.port.js';

const DOWNLOAD_TIMEOUT_MS = 120_000;

interface R2Settings {
  readonly accountId: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;
  readonly publicBaseUrl: string;
}

/** Borde mínimo del cliente S3 que usa el adaptador (inyectable en tests). */
export interface S3Sender {
  send(command: unknown): Promise<unknown>;
}

export interface R2MediaStorageHooks {
  /** `fetch` inyectable para tests. */
  readonly fetchFn?: typeof fetch;
  /** Fábrica del cliente S3, inyectable para tests. */
  readonly createClient?: (settings: R2Settings) => S3Sender;
}

/**
 * Copia la media generada a un bucket compatible con S3 (Cloudflare R2) para
 * que la URL pública del borrador no dependa del proveedor de IA. El bucket
 * debe tener habilitado el acceso público (r2.dev o dominio propio) y
 * `R2_PUBLIC_BASE_URL` apunta a esa base.
 */
export class R2MediaStorage implements MediaStorage {
  private readonly logger = new Logger(R2MediaStorage.name);
  private readonly fetchFn: typeof fetch;
  private readonly createClient: (settings: R2Settings) => S3Sender;
  private client: S3Sender | null = null;

  constructor(
    private readonly config: ConfigService,
    hooks: R2MediaStorageHooks = {},
  ) {
    this.fetchFn = hooks.fetchFn ?? fetch;
    this.createClient = hooks.createClient ?? defaultClientFactory;
  }

  async uploadFromUrl(input: MediaUploadInput): Promise<string> {
    const settings = this.readSettings();
    const { body, contentType } = await this.download(
      input.sourceUrl,
      input.contentType,
    );

    try {
      await this.clientFor(settings).send(
        new PutObjectCommand({
          Bucket: settings.bucket,
          Key: input.key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      this.logger.error(
        `R2 rechazó la subida de ${input.key}: ${describeError(error)}`,
      );
      throw new AiGenerationUnavailableError({
        code: 'R2_UPLOAD_FAILED',
        provider: 'R2',
        message: 'No se pudo guardar la media generada. Vuelve a intentarlo.',
        retryable: true,
      });
    }

    return `${settings.publicBaseUrl}/${input.key}`;
  }

  private async download(
    sourceUrl: string,
    fallbackContentType: string,
  ): Promise<{ readonly body: Uint8Array; readonly contentType: string }> {
    let response: Response;
    try {
      response = await this.fetchFn(sourceUrl, {
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(
        `No se pudo descargar la media generada: ${describeError(error)}`,
      );
      throw mediaDownloadFailed();
    }

    if (!response.ok) {
      this.logger.error(
        `La descarga de la media respondió HTTP ${response.status}`,
      );
      throw mediaDownloadFailed();
    }

    const body = new Uint8Array(await response.arrayBuffer());
    const header = response.headers
      .get('content-type')
      ?.split(';')[0]
      ?.trim()
      .toLowerCase();

    return {
      body,
      contentType:
        header !== undefined && header !== '' ? header : fallbackContentType,
    };
  }

  private readSettings(): R2Settings {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID')?.trim();
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID')?.trim();
    const secretAccessKey = this.config
      .get<string>('R2_SECRET_ACCESS_KEY')
      ?.trim();
    const bucket = this.config.get<string>('R2_BUCKET')?.trim();
    const publicBaseUrl = this.config
      .get<string>('R2_PUBLIC_BASE_URL')
      ?.trim()
      .replace(/\/+$/, '');

    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucket ||
      !publicBaseUrl
    ) {
      this.logger.error('R2_* no está configurado por completo');
      throw new AiGenerationUnavailableError({
        code: 'R2_NOT_CONFIGURED',
        provider: 'R2',
        message:
          'El almacenamiento de media no está configurado. Avisa al administrador.',
        retryable: false,
      });
    }

    return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
  }

  private clientFor(settings: R2Settings): S3Sender {
    this.client ??= this.createClient(settings);
    return this.client;
  }
}

function mediaDownloadFailed(): AiGenerationUnavailableError {
  return new AiGenerationUnavailableError({
    code: 'MEDIA_DOWNLOAD_FAILED',
    provider: 'FAL',
    message: 'No se pudo descargar la media generada. Vuelve a intentarlo.',
    retryable: true,
  });
}

function describeError(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`.replace(/\s+/g, ' ').slice(0, 300)
    : 'error inesperado';
}

function defaultClientFactory(settings: R2Settings): S3Sender {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });
}
