import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";

/**
 * The CEO's side of standing permission (CC). For a client it is the client's decision, so the CEO can set one only under the
 * permission the owner gave them; with it, and the emailed code, it goes through, says it was granted on the client's behalf, and the
 * client's owner sees that and can take it back. Runs after the owner's own spec, which left none in force.
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
test.beforeEach(() => forgetSignInRequests());

test("the CEO sets a standing permission for a client under the client's permission, the owner sees it as done for them and takes it back", async ({ browser, page }) => {
  await signIn(page, CEO);
  await page.getByRole("button", { name: "Preview Computer" }).click();
  await page.getByRole("button", { name: "Open operating system" }).click();
  await page.getByRole("tab", { name: "Security/Gov" }).click();

  const orbit = page.getByRole("region", { name: "Standing permission for Orbit" });
  await expect(orbit).toBeVisible();
  await expect(orbit.getByText("The agency asks about any kind of work a plan does not name.")).toBeVisible();
  await orbit.getByRole("button", { name: "Allow without asking" }).click();
  await expect(orbit.getByText(/it goes through only under the permission their owner gave you/)).toBeVisible();
  const kinds = orbit.getByRole("group", { name: "Which kinds of work may we do without asking?" });
  await expect(kinds.getByRole("checkbox").first()).toBeVisible();
  await kinds.getByRole("checkbox").first().check();
  await orbit.getByLabel("For how long").selectOption("30");

  const asked = mailCount();
  await orbit.getByRole("button", { name: "Allow these without asking" }).click();
  await expect(orbit.getByText(/^In force, until/)).toHaveCount(0); // nothing is set until the code is right
  const code = await mailTo(CEO, "step-up", asked);
  const form = orbit.getByRole("form", { name: "Confirm it's you" });
  await form.getByPlaceholder("Six-digit code").fill(code.meta!.code!);
  await form.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(orbit.getByText(/^In force, until/)).toBeVisible();
  await expect(orbit).toContainText("Granted by you, on the client's behalf, under the permission they gave.");

  // it shows among what the agency may do without asking, flagged as granted on the client's behalf
  await expect(page.getByLabel("Delegations in force")).toContainText("standing permission");
  await expect(page.getByLabel("Delegations in force")).toContainText("granted on the client's behalf");

  // the client's owner sees it, knows it was done for them, and takes it back
  const ownerPage = await (await browser.newContext()).newPage();
  await signIn(ownerPage, OWNER);
  await ownerPage.goto("/client");
  const mine = ownerPage.getByRole("region", { name: "Standing permission" });
  await expect(mine.getByText(/^In force, until/)).toBeVisible();
  await expect(mine).toContainText("Granted for you by the agency's CEO, under the permission you gave.");
  await mine.getByRole("button", { name: "Take this back" }).click();
  await mine.getByRole("button", { name: "Confirm: take it back" }).click();
  await expect(mine.getByText(/^In force, until/)).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Preview Computer" }).click();
  await page.getByRole("button", { name: "Open operating system" }).click();
  await page.getByRole("tab", { name: "Security/Gov" }).click();
  await expect(page.getByRole("region", { name: "Standing permission for Orbit" }).getByText(/^In force, until/)).toHaveCount(0);
  await ownerPage.context().close();
});
