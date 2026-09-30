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

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
