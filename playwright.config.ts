import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

/**
 * End-to-end tests run the real stack: the dev-playbook-v4 API on a scratch database, and this app built against it.
 * See e2e/global-setup.ts for what must be available (a v4 checkout, Postgres, Redis).
 */
const sandboxBrowser = "/opt/pw-browsers/chromium";
const executablePath = process.env["CHROMIUM_PATH"] ?? (existsSync(sandboxBrowser) ? sandboxBrowser : undefined);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3100",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
    trace: "retain-on-failure",
  },
});
