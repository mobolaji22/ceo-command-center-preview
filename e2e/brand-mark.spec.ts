import { expect, test, type Page } from "@playwright/test";
import { evidence } from "./evidence";

/**
 * v4 ADR-0095: the mark the CEO chose signs every screen, starting with the lobby before anyone signs in. Choosing it and serving
 * it are v4's, tested there on the real database; this checks only how the Command Center draws what v4 answers, so the brand is
 * v4's real answer with a mark added, and the SVG is a drawn square.
 */
const MARK = { assetId: "e2e-mark", version: 2 };
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M8 8h48v48H8z" fill="#2f5d3a"/></svg>';

async function withMark(page: Page, served: "svg" | "missing") {
  await page.route("**/api/v4/v1/agency/brand", async (route) => {
    const real = await route.fetch();
    await route.fulfill({ response: real, json: { ...(await real.json()), mark: MARK } });
  });
  await page.route("**/api/v4/v1/agency/brand/mark?**", (route) => served === "svg"
    ? route.fulfill({ status: 200, contentType: "image/svg+xml", body: SVG })
    : route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"NOT_FOUND"}' }));
}

evidence(test);

// A brand request still being answered when a test ends would find its page gone; the routes go with the test.
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "ignoreErrors" }); });

test("the lobby is signed with the chosen mark, as an image, by its version", async ({ page }) => {
  await withMark(page, "svg");
  await page.goto("/auth");
  const mark = page.locator(".lobby-plaque img.brand-mark-image");
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute("src", /\/api\/v4\/v1\/agency\/brand\/mark\?v=e2e-mark\.2$/);
  await expect(mark).toHaveAttribute("alt", "");
  expect(await mark.evaluate((img: HTMLImageElement) => img.naturalWidth > 0)).toBe(true);
});

test("a mark that does not load leaves the plain square, never a broken picture", async ({ page }) => {
  await withMark(page, "missing");
  await page.goto("/auth");
  await expect(page.locator(".lobby-plaque .brand-mark")).toBeVisible();
  await expect(page.locator(".lobby-plaque img")).toHaveCount(0);
});

test("with no mark chosen, the lobby keeps the plain square", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.locator(".lobby-plaque .brand-mark")).toBeVisible();
  await expect(page.locator(".lobby-plaque img")).toHaveCount(0);
});
