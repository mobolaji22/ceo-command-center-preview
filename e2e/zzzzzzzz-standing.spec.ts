import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";

/**
 * Standing permission (CC): the client's owner lets the agency do named kinds of work without asking each time, for a limited time.
 * It needs the emailed code, nothing is allowed until the code is right, it shows what it covers and when it ends, and it can be taken
 * back. Kinds that always ask (publishing, sending, deleting, paying) are never offered.
 */
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

test("the owner allows some kinds of work without asking, after the code, sees it in force, and takes it back", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/client");
  const section = page.getByRole("region", { name: "Standing permission" });
  await expect(section.getByText("The agency asks you about any kind of work a plan does not name.")).toBeVisible();

  await section.getByRole("button", { name: "Allow without asking" }).click();
  const kinds = section.getByRole("group", { name: "Which kinds of work may we do without asking?" });
  await expect(kinds.getByRole("checkbox").first()).toBeVisible();
  await expect(kinds.getByText(/publish|send|delete|pay/i)).toHaveCount(0); // what always asks is never offered
  const chosen = await kinds.getByRole("checkbox").first().locator("xpath=..").innerText();
  await kinds.getByRole("checkbox").first().check();
  await section.getByLabel("For how long").selectOption("7");
  await expect(section.getByRole("button", { name: "Allow these without asking" })).toBeEnabled();

  const asked = mailCount();
  await section.getByRole("button", { name: "Allow these without asking" }).click();
  const form = section.getByRole("form", { name: "Confirm it's you" });
  await expect(form).toBeVisible();
  await expect(section.getByText(/^In force, until/)).toHaveCount(0); // nothing is allowed until the code is right
  const code = await mailTo(OWNER, "step-up", asked);
  await form.getByPlaceholder("Six-digit code").fill(code.meta!.code!);
  await form.getByRole("button", { name: "Confirm", exact: true }).click();

  await expect(section.getByText(/^In force, until/)).toBeVisible();
  await expect(section).toContainText(chosen.trim());
  await expect(section).toContainText("It adds no spending of its own");
  await page.reload();
  await expect(page.getByRole("region", { name: "Standing permission" }).getByText(/^In force, until/)).toBeVisible();

  const again = page.getByRole("region", { name: "Standing permission" });
  await again.getByRole("button", { name: "Take this back" }).click();
  await again.getByLabel("Why (optional)").fill("Not any more");
  await again.getByRole("button", { name: "Confirm: take it back" }).click();
  await expect(again.getByText(/^In force, until/)).toHaveCount(0);
  await expect(again.getByText("The agency asks you about any kind of work a plan does not name.")).toBeVisible();
  await expect(again).toContainText("Not any more");
});
