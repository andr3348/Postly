import cookieParser from 'cookie-parser';
import type { INestApplication } from '@nestjs/common';

/**
 * Configuración compartida entre `main.ts` y los tests e2e
 * (que no pasan por `main.ts`): middlewares Express globales.
 */
export function setupApp(app: INestApplication): void {
  // Cookies HttpOnly = transporte de los JWT (ver modules/auth).
  app.use(cookieParser());
}
