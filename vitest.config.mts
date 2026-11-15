import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    env: loadEnv(mode, process.cwd(), ""),
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          testTimeout: 30_000,
          hookTimeout: 60_000,
          // tests share one remote database: run files one at a time
          fileParallelism: false,
        },
      },
    ],
  },
}));
