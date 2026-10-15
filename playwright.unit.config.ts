import { defineConfig } from "@playwright/test";

/**
 * Tests that need no browser and no backend (the Design Workshop's document rules), so CI runs them on every push. The full
 * end-to-end suite (playwright.config.ts) runs the real stack and is run where a v4 checkout, Postgres and Redis exist.
 */
export default defineConfig({ testDir: "e2e", testMatch: /(design-logic|walk-path)\.spec\.ts/, workers: 1 });
