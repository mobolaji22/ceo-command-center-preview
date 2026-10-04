import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page, test as playwrightTest } from "@playwright/test";

/**
 * Screenshots of the real screens, taken as the journey runs, to show the path with evidence. Off unless E2E_EVIDENCE names a folder, so
 * ordinary runs are unchanged. The files are numbered in the order they were taken (the specs run one after another), and each is
 * written alongside a short caption that the report reads.
 */
const dir = () => process.env["E2E_EVIDENCE"];
let taken = 0;

export async function shot(from: Page | Locator, caption: string): Promise<void> {
  const folder = dir();
  if (!folder) return;
  mkdirSync(folder, { recursive: true });
  const page = "page" in from && typeof (from as Locator).page === "function" ? (from as Locator).page() : (from as Page);
  // The next number is read from what is already there, because each spec file runs in its own process.
  taken = readdirSync(folder).filter((f) => f.endsWith(".png")).length + 1;
  const name = `${String(taken).padStart(3, "0")}`;
  await page.screenshot({ path: join(folder, `${name}.png`), fullPage: true });
  writeFileSync(join(folder, `${name}.txt`), caption);
}

/** After every test in the file, the screen it ended on. */
export function evidence(test: typeof playwrightTest): void {
  test.afterEach(async ({ page }, info) => { await shot(page, `End of: ${info.title}`); });
}
