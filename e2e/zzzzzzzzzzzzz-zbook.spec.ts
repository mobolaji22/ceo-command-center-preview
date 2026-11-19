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

  // What to settle before going live (v4 ADR-0075): v4's notice to ask counsel comes first, and with nothing read, nothing applies yet.
  await chapter(book, /Before it goes live/).click();
  await expect(book.getByRole("note")).toHaveText("This screen is not legal advice. Before the work goes live, please ask your own legal counsel about the items listed here.");
  await expect(book.getByRole("status")).toContainText("Not yet confirmed, because no source was read");
  const privacy = book.getByRole("listitem", { name: /Customers' details may be used only/ });
  await expect(privacy).toContainText("Expected to apply, still to be confirmed");
  await expect(privacy).not.toContainText("Not settled yet");
  await expect(privacy).toContainText("Ask a privacy specialist about this one.");
  await expect(privacy).toContainText("A privacy notice linked beside every form");
  // What to look up, what to settle first, and what only the client can do (v4 ADR-0075 Decision 10).
  await expect(privacy).toContainText("Settle before it goes live");
  await expect(privacy).toContainText("Recalled, not checked: The data protection act. Where to read it: The data protection regulator where the roastery is registered.");
  await expect(book.getByRole("listitem", { name: /Show a refund policy/ })).not.toContainText("Settle before it goes live");
  // A condition that repeats its label, and a source ending in its own full stop, are said once (blind probes, 2026-11-14).
  await expect(book.getByRole("listitem", { name: /Show a refund policy/ })).toContainText("Applies if: the payment provider's terms require one.");
  await expect(book.getByRole("heading", { name: "What only you can do" })).toBeVisible();
  await expect(book.getByText("Keep a record of each customer who agrees to marketing, and when.")).toBeVisible();
  // The agency's own notes reach the CEO and no client (v4 ADR-0075 Decision 11).
  await expect(book.getByRole("heading", { name: "For the agency only" })).toBeVisible();
  await expect(book.getByText("The client does not see this part.")).toBeVisible();
  await expect(book.getByText("We write the product copy, so the contract should have the roastery approve every claim we draft.")).toBeVisible();
  await expect(book.getByText(/compliant/i)).toHaveCount(0);

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
  await expect(chapter(book, /Before it goes live/)).toBeVisible();

  // Saving it as a PDF prints every released chapter from this same view, and nothing else on the page.
  await page.evaluate(() => { const w = window as Window & { printed?: number }; w.print = () => { w.printed = (w.printed ?? 0) + 1; }; });
  await book.getByRole("button", { name: "Save as PDF" }).click();
  // On screen the printed book is laid out but not shown, so it is found among hidden elements until the page is printed.
  const printed = page.getByRole("article", { name: "The book, for printing", includeHidden: true });
  await expect(printed.getByRole("heading", { name: /The brand/, includeHidden: true })).toBeAttached();
  await expect(printed.getByRole("heading", { name: /Selling it/, includeHidden: true })).toBeAttached();
  await expect(printed.getByRole("heading", { name: /Before it goes live/, includeHidden: true })).toBeAttached();
  await expect(printed.getByRole("heading", { name: "For the agency only", includeHidden: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as Window & { printed?: number }).printed)).toBe(1);
  await expect(page).toHaveTitle(`${story.projectName} - the book`);
  await page.emulateMedia({ media: "print" });
  await expect(printed).toBeVisible();
  await expect(desk).toBeHidden();
  await page.emulateMedia({ media: null });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(printed).toHaveCount(0);

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
