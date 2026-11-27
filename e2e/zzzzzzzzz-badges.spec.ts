import { newDirective } from "./directive";
import { openFromStudio } from "./studio";
import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";

/**
 * The studio's Decide card says how many things wait on the CEO (v4 ADR-0099, slice 4.2). A directive that is asking a question
 * waits on the CEO, so it is on Decide with what it is, the card's count is v4's count, and pressing the item opens the request it
 * belongs to. Know and Board count other things and carry their own numbers.
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

test.describe.configure({ mode: "serial" });
evidence(test);
test.beforeEach(() => forgetSignInRequests());

test("a directive that is asking a question is on Decide, the count is v4's, and pressing it opens the request", async ({ page }) => {
  await signIn(page, CEO);
  // a request too vague to plan is asking the CEO a question
  await openFromStudio(page, "requests");
  const composer = await newDirective(page);
  await composer.getByLabel("FOR").selectOption({ label: "Orbit" });
  await composer.getByLabel("WHAT WOULD YOU LIKE DONE?").fill("Refresh the brand");
  await composer.getByRole("button", { name: "Send request" }).click();
  await expect(page.locator(".directive-detail").getByRole("status").first()).toContainText("Received.");

  await page.goto("/");
  const studio = await (await page.request.get("/api/v4/v1/studio")).json();
  const decide = page.locator(".dock-decide");
  await expect(decide.locator(".dock-card-line")).toHaveText(`${studio.decide.count} waiting on your pen`);
  const asked = decide.getByRole("button", { name: /^A question for you/ }).first();
  await expect(asked).toBeVisible();
  await shot(page, "The studio: Decide names what waits on the CEO");

  await asked.click();
  // It opens the CEO's requests on "Needs you", where the request that asked is.
  await expect(page.getByRole("tab", { name: /^Needs you/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".thread-row", { hasText: "Refresh the brand" }).first()).toBeVisible();
});
