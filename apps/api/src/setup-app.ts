import cookieParser from 'cookie-parser';
import type { INestApplication } from '@nestjs/common';

/**
 * Configuración compartida entre `main.ts` y los tests e2e
 * (que no pasan por `main.ts`): middlewares Express globales.
 */
export function setupApp(app: INestApplication): void {
  // Cookies HttpOnly = transporte de los JWT (ver modules/auth).
  app.use(cookieParser());
  // Sin esto el dashboard (Next.js, otro origen) no puede autenticarse:
  // el navegador bloquea cookies cross-origin sin CORS + credentials.
  // Orígenes coma-separados para preview/staging (ver .env.example).
  const origins = (process.env['WEB_ORIGIN'] ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
  app.enableCors({ origin: origins, credentials: true });
}
