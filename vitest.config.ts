import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["packages/**/src/**/*.ts", "apps/editor/src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "apps/editor/src/main.ts",
        "apps/editor/src/preload.ts",
        "apps/editor/src/preview.ts",
        "apps/editor/src/ipc-registration.ts",
        "apps/editor/src/renderer.tsx",
        "apps/editor/src/ui/**",
        "apps/player-web/**",
        "apps/sample-game/**",
        "packages/cli/**",
        "packages/renderer-2d/**"
      ],
      thresholds: {
        branches: 60,
        functions: 70,
        lines: 70,
        statements: 70
      }
    }
  }
});
