import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Secretos solo para e2e local (nunca producción). El AuthModule exige
// JWT_* presentes y falla rápido sin ellos; aquí se fijan los de prueba.
process.env['JWT_ACCESS_SECRET'] ??= 'e2e-access-secret-only-for-tests';
process.env['JWT_REFRESH_SECRET'] ??= 'e2e-refresh-secret-only-for-tests';
// 64 hex chars (requisito de AES-256-GCM); solo pruebas, nunca producción.
process.env['ENCRYPTION_KEY'] ??= 'ab'.repeat(32);
// API key de servicio para n8n; solo pruebas, nunca producción.
process.env['N8N_API_KEY'] ??= 'e2e-n8n-api-key-only-for-tests';
// Webhook de n8n: el notifier exige ambas al construirse. El e2e sobreescribe
// el puerto, pero AppModule igual instancia el adapter real.
process.env['N8N_DISPATCH_WEBHOOK_URL'] ??= 'http://127.0.0.1:9/webhook/e2e';
process.env['INTERNAL_WEBHOOK_SECRET'] ??= 'e2e-webhook-secret-only-for-tests';
// OAuth de Meta: los specs que no lo prueban instancian igual el cliente real
// (con opciones válidas de prueba); el spec de meta-oauth lo reemplaza por un
// fake. Nunca son credenciales reales.
process.env['META_APP_ID'] ??= 'e2e-meta-app-id';
process.env['META_APP_SECRET'] ??= 'e2e-meta-app-secret';
process.env['META_OAUTH_REDIRECT_URI'] ??=
  'http://localhost:3001/api/connected-accounts/meta/oauth/callback';
process.env['WEB_APP_URL'] ??= 'http://localhost:3000';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Los 6 specs comparten la DB de prueba: en paralelo, el claim de
    // dispatch puede robar publicaciones SCHEDULED de otro spec (flaky).
    fileParallelism: false,
  },
});
