import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      // Deterministic "today" and no external calls during tests.
      DEMO_TODAY: "2026-11-09",
      APP_TIMEZONE: "America/Los_Angeles",
      PAYPAL_MODE: "mock",
      AI_MODE: "mock",
      DATABASE_URL: "",
    },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
