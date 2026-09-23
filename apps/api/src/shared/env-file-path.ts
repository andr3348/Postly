import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Ruta absoluta de `apps/api/.env`, anclada al package root por búsqueda
 * ascendente del `package.json`. Independiente del CWD: funciona igual en
 * `src/` (vitest), `dist/` (nest build) y cualquier cwd de ejecución.
 */
export function resolveApiEnvFilePath(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (!existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error('[env] Could not locate apps/api package root');
    }
    dir = parent;
  }
  return path.join(dir, '.env');
}
