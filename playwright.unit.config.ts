import { defineConfig } from "@playwright/test";

/**
 * Tests that need no browser and no backend (the Design Workshop's document rules, and reading v4's design document), so CI runs them on every push. The full
 * end-to-end suite (playwright.config.ts) runs the real stack and is run where a v4 checkout, Postgres and Redis exist.
 */
export default defineConfig({ testDir: "e2e", testMatch: /(design-logic|sdd-v4-logic)\.spec\.ts/, workers: 1 });
