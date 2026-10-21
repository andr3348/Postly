/** Entrada puramente de dominio para subir media a almacenamiento propio. */
export interface MediaUploadInput {
  /** URL de origen (p. ej. fal.ai) que el adaptador descarga. */
  readonly sourceUrl: string;
  /** Content-Type detectado aguas arriba; sirve para nombrar la subida. */
  readonly contentType: string;
  /** Ruta destino dentro del bucket, sin slash inicial. */
  readonly key: string;
}

/**
 * Puerto de almacenamiento propio de la media (R2/S3). Copiar la media evita
 * depender de la retención o del hosting del proveedor de IA.
 */
export interface MediaStorage {
  /** Sube el objeto y devuelve la URL pública final. */
  uploadFromUrl(input: MediaUploadInput): Promise<string>;
}

export const MEDIA_STORAGE: unique symbol = Symbol('MediaStorage');
