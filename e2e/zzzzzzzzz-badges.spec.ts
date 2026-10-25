import { newDirective } from "./directive";
import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";

/**
 * The hotspots in the office say how many things need the CEO (CC). A directive that is asking a question needs the CEO, so the
 * directive desk and the phone carry a count, the count is what a person who cannot see the badge hears, and it is what opening the
 * desk finds. The brief and the door carry none.
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

test("a directive that is asking a question puts a count on the directive desk and the phone, and the desk shows exactly that many", async ({ page }) => {
  await signIn(page, CEO);
  // a request too vague to plan is asking the CEO a question
  await page.getByRole("button", { name: "Preview Directive" }).click();
  await page.getByRole("button", { name: "Compose directive" }).click();
  const composer = await newDirective(page);
  await composer.getByLabel("FOR").selectOption({ label: "Orbit" });
  await composer.getByLabel("WHAT WOULD YOU LIKE DONE?").fill("Refresh the brand");
  await composer.getByRole("button", { name: "Send request" }).click();
  await expect(page.locator(".directive-detail").getByRole("status").first()).toContainText("Received.");

  await page.goto("/");
  const directive = page.getByRole("button", { name: "Preview Directive" });
  const phone = page.getByRole("button", { name: "Preview Phone" });
  await expect(directive).toHaveAccessibleDescription(/^\d+ (needs|need) you$/);
  await expect(phone).toHaveAccessibleDescription(/^\d+ (needs|need) you$/);
  const badge = (await directive.locator(".hotspot-badge").innerText()).trim();
  expect(badge).toMatch(/^[1-9]$/);
  // the brief and the door carry no count
  await expect(page.getByRole("button", { name: "Preview Brief" }).locator(".hotspot-badge")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Preview Door" }).locator(".hotspot-badge")).toHaveCount(0);
  await shot(page, "The office: a count on the places that need the CEO");

  await directive.click();
  await page.getByRole("button", { name: "Compose directive" }).click();
  // The desk opens on "Needs you", and it lists exactly what the badge counted.
  await expect(page.getByRole("tab", { name: /^Needs you/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".directive-row")).toHaveCount(Number(badge));
});
