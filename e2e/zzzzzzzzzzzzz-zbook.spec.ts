import { expect, test, type Locator, type Page } from "@playwright/test";
import { forgetSignInRequests, seedFinishedBrandRun } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence } from "./evidence";
import { openClientDesk } from "./client-room";

/**
 * The client's book (dev-playbook-v4 ADR-0053, ADR-0054). A Brand run has finished on the client's newest project: a position chosen,
 * Content's kit written, and Market's research still drafted. The CEO reads the whole book in the Brand room, the drafted market
 * chapter with its banner, and proposes keeping the brand. The client's owner reads the brand chapters in their Library, is told the
 * market chapters are still to come, and keeps the brand, confirming who they are. What each may read and do is v4's to decide.
 * Runs after the Workshop journey (which adds the newest project), before the phone pass.
 */
const CEO = "ceo@agency.example";
const OWNER = "owner@orbit.example";

async function signIn(page: Page, email: string) {
  const before = mailCount();
  await page.goto("/auth");
  await page.getByLabel("EMAIL").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  const mail = await mailTo(email, "sign-in", before);
  await page.goto(mail.meta!.link!);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

test.describe.configure({ mode: "serial" });
evidence(test);
test.beforeEach(() => forgetSignInRequests());

const story = { projectName: "" };
const chapter = (book: Locator, name: RegExp) => book.getByRole("tab", { name });

test("the CEO reads the whole book in the Brand room, the drafted market chapter included, and proposes keeping the brand", async ({ page }) => {
  story.projectName = seedFinishedBrandRun(OWNER).projectName;
  await signIn(page, CEO);
  await page.goto("/?room=BRAND&spot=book");
  const desk = page.locator('[data-desk="paper"]');
  await expect(desk.locator(".desk-heading h2")).toContainText("The book");
  const picker = desk.getByLabel("Project");
  if (await picker.count()) await picker.selectOption({ label: story.projectName });
  const book = desk.getByRole("article", { name: "The book" });
  await expect(book.locator(".book-statement").first()).toHaveText("The roastery that prints the roast date on every bag.");
  await expect(book.getByRole("heading", { name: "The story" })).toBeVisible();

  await chapter(book, /Selling it/).click();
  await expect(book.locator(".book-statement")).toHaveText("The roastery that prints the roast date on every bag.");
  await expect(book.getByText("Read the date, not the claim.")).toBeVisible();

  await chapter(book, /The market/).click();
  await expect(book.getByRole("note")).toBeVisible();
  await chapter(book, /What it means for you/).click();
  await expect(book.getByText("What this means for the business is still to be written.")).toBeVisible();

  await chapter(book, /The brand/).click();
  const keep = book.getByRole("complementary", { name: "Keep this brand" });
  await keep.getByRole("button", { name: "Propose keeping it" }).click();
  await expect(keep.getByRole("status").first()).toContainText("Waiting for the client's owner to decide.");
});

test("the client's owner reads the brand chapters, is told the market is still to come, and keeps the brand", async ({ page }) => {
  await signIn(page, OWNER);
  await openClientDesk(page, "Shelf", "Your book");
  const desk = page.locator('[data-desk="shelf"]');
  const picker = desk.getByLabel("Project");
  if (await picker.count()) await picker.selectOption({ label: story.projectName });
  const book = desk.getByRole("article", { name: "The book" });
  await expect(book.getByRole("list", { name: "Still to come" })).toContainText("The market chapters arrive once the research is complete and judged sufficient.");
  await expect(chapter(book, /The market/)).toHaveCount(0);
  await expect(chapter(book, /Selling it/)).toBeVisible();

  const keep = book.getByRole("complementary", { name: "Keep this brand" });
  const before = mailCount();
  await keep.getByRole("button", { name: "Keep it" }).click();
  const form = keep.getByRole("form", { name: "Confirm it's you" });
  const kept = keep.getByText("Kept: it stands in for Brand on the next projects.");
  await expect(form.or(kept)).toBeVisible();
  if (await form.isVisible()) {
    const mail = await mailTo(OWNER, "step-up", before);
    await form.getByPlaceholder("Six-digit code").fill(mail.meta!.code!);
    await form.getByRole("button", { name: "Confirm", exact: true }).click();
  }
  await expect(kept).toBeVisible();
});
