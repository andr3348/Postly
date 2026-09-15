import { isBuiltin } from "node:module";
import { defineConfig } from "tsdown";

export default defineConfig([
  {
    // Deploy entry for Prisma Composer (`service.ts` points at
    // `./dist/server.mjs`). Kept as a single self-contained file.
    entry: { server: "src/index.ts" },
    platform: "node",
    target: "node22.18",
    format: "esm",
    clean: true,
    hash: false,
    dts: false,
    outputOptions: {
      codeSplitting: false,
    },
    deps: {
      onlyBundle: false,
      alwaysBundle: (id) => !isBuiltin(id),
    },
  },
  {
    // Library entry for the Turborepo (`import ... from "database"`).
    // Also single-file so NestJS gets one `client.mjs` + types.
    entry: { client: "src/client.ts" },
    platform: "node",
    target: "node22.18",
    format: "esm",
    clean: false,
    hash: false,
    dts: true,
    outputOptions: {
      codeSplitting: false,
    },
    deps: {
      onlyBundle: false,
      alwaysBundle: (id) => !isBuiltin(id),
    },
  },
]);
