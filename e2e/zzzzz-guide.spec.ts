import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests, seedGuidedStep } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";

/**
 * A person's step with a guide (v4 ADR-0071), on the contracts desk where the work's questions are. The CEO, who does the agency's
 * step while nobody else is assigned, reads the steps, logs them with the proof each needs, and sees how far it has got. "It is done"
 * is refused, naming what is left, until every step is finished.
 */
const CEO = "ceo@agency.example";

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

evidence(test);
test.beforeEach(() => forgetSignInRequests());

test("the CEO follows a person's step's guide, logs each step with its proof, and cannot call it done early", async ({ page }) => {
  const q = seedGuidedStep(CEO);
  await signIn(page, CEO);
  await page.getByRole("button", { name: "Contracts", exact: true }).click();
  const card = page.locator(".contracts-desk").getByRole("article", { name: q.title }).filter({ has: page.getByLabel("Step-by-step guide") }).first();
  const guide = card.getByLabel("Step-by-step guide");
  await expect(guide).toContainText("0 of 9 steps done");
  await expect(guide).toContainText("What it is for: Open an online candle store that takes orders in Lagos");

  // Done too early: the refusal names what is left.
  await card.getByRole("button", { name: "It is done" }).click();
  await card.getByRole("button", { name: "Confirm: it is done" }).click();
  await expect(card.getByRole("status").last()).toContainText("Steps not done yet: Open the store account");

  // A step that needs a note of what was done.
  const account = guide.getByRole("listitem", { name: "Open the store account in the client's name" });
  await account.getByRole("button", { name: "Open the store account in the client's name" }).click();
  await expect(account).toContainText("Never write a password, key or bank detail into this log.");
  await account.getByRole("button", { name: "Done" }).click();
  await account.getByLabel("What was done?").fill("Bumpa account opened with the client's email; we have a staff login");
  await account.getByRole("button", { name: "Log it" }).click();
  await expect(account.locator(".pill")).toHaveText("DONE");
  await expect(guide).toContainText("1 of 9 steps done");

  // A step that needs a link is refused without one.
  const design = guide.getByRole("listitem", { name: "Apply the approved design" });
  await design.getByRole("button", { name: "Apply the approved design" }).click();
  await design.getByRole("button", { name: "Done" }).click();
  await design.getByRole("button", { name: "Log it" }).click();
  await expect(design.getByRole("status")).toContainText("needs an https link");

  // Stuck says what is in the way, and the CEO sees it counted.
  const delivery = guide.getByRole("listitem", { name: "Set delivery" });
  await delivery.getByRole("button", { name: "Set delivery" }).click();
  await delivery.getByRole("button", { name: "I'm stuck" }).click();
  await delivery.getByLabel("What is in the way?").fill("The courier has not sent the account details");
  await delivery.getByRole("button", { name: "Log it" }).click();
  await expect(delivery.locator(".pill")).toHaveText("STUCK");
  await expect(guide).toContainText("1 of 9 steps done · 1 stuck");
  await shot(page, "A person's step with its guide: one step done, one stuck, and what is left");
});
