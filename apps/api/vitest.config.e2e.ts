import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Secretos solo para e2e local (nunca producción). El AuthModule exige
// JWT_* presentes y falla rápido sin ellos; aquí se fijan los de prueba.
process.env['JWT_ACCESS_SECRET'] ??= 'e2e-access-secret-only-for-tests';
process.env['JWT_REFRESH_SECRET'] ??= 'e2e-refresh-secret-only-for-tests';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
