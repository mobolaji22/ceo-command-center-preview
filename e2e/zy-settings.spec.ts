import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";

/**
 * Settings (P6.21): the header's settings icon opens everything about how the agency runs. The CEO prices the agency here: the
 * agency fee and the rate card, each change behind a fresh emailed code. Runs after sign-in.spec.ts and before the specs that
 * read a plan's price.
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

test("the CEO prices the agency in Settings: each change asks for the emailed code first, and nothing changes until it is right", async ({ page }) => {
  await signIn(page, CEO);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });

  // How the agency runs: read only.
  await settings.getByRole("tab", { name: "How the agency runs", exact: true }).click();
  await expect(settings.getByText("Demo", { exact: true })).toBeVisible();
  await expect(settings.getByText("Nothing", { exact: true })).toBeVisible();

  // The agency fee: a fresh code first.
  await settings.getByRole("tab", { name: "Pricing", exact: true }).click();
  await expect(settings.getByText("Not set: until it is, plans carry no price.")).toBeVisible();
  await settings.getByLabel("Agency fee for every client").fill("15");
  const asked = mailCount();
  await settings.getByRole("button", { name: "Save" }).first().click();
  const form = settings.getByRole("form", { name: "Confirm it's you" });
  await expect(form).toBeVisible();
  await expect(settings.getByText("The agency fee is now 15%.")).toHaveCount(0); // nothing changed yet
  await shot(page, "Changing what clients pay asks for a fresh emailed code first");
  const mail = await mailTo(CEO, "step-up", asked);
  await form.getByPlaceholder("Six-digit code").fill(mail.meta!.code!);
  await form.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(settings.getByRole("status")).toHaveText("The agency fee is now 15%.");

  // The rate card, one effort level at a time (the proof is still fresh).
  for (const [level, usd] of [["Light", "300"], ["Standard", "800"], ["Strict", "1500"], ["Critical", "2500"]] as const) {
    const input = settings.getByLabel(`${level} rate`);
    await input.fill(usd);
    await input.locator("xpath=ancestor::form").getByRole("button", { name: "Save" }).click();
    await expect(settings.getByRole("status")).toContainText(`${level} work now costs $${Number(usd).toLocaleString("en-US")}.`);
  }
  await expect(settings.getByText("$800 each")).toBeVisible();
  await shot(page, "Pricing: the agency fee and the rate card, as the CEO set them");

  // Model spend: no envelope, so no paid model runs.
  await settings.getByRole("tab", { name: "Model spend", exact: true }).click();
  await expect(settings.getByText("No envelope set")).toBeVisible();

  // Sessions: this one is marked, and is never offered for signing out.
  await settings.getByRole("tab", { name: "Your sessions", exact: true }).click();
  await expect(settings.getByText(/this one/)).toBeVisible();
});
