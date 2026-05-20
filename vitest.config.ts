import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["artifacts/api-server/src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      include: ["artifacts/api-server/src/**/*.ts"],
      exclude: ["artifacts/api-server/src/**/*.test.ts", "**/index.ts"],
    },
    server: {
      deps: {
        inline: ["@workspace/db", "@workspace/api-zod"],
      },
    },
  },
});
