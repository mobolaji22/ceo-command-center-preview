import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests, stopRunAtBudget } from "./db";
import { mailCount, mailTo } from "./outbox";

/**
 * Answering a stopped project's question with something that commits money or authority (here, approving a step the plan did not
 * cover) asks for the emailed code, as approving a plan does. Runs last: it drives the checkout project's run, which stops asking.
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

test("approving a step outside the plan asks the client's owner for the emailed code, and nothing changes until it is right", async ({ page }) => {
  const stopped = stopRunAtBudget("checkout");
  expect(stopped.reason).toBe("AWAITING_APPROVAL");
  const asking = (p: Page) => p.getByRole("article", { name: /^Your go-ahead is needed/ });

  await signIn(page, OWNER);
  await page.goto("/client");
  const question = asking(page);
  await expect(question).toBeVisible();
  await question.getByRole("button", { name: "Approve this step" }).click();
  await expect(question.getByText("we will ask you for a six-digit code")).toBeVisible();
  await question.getByRole("button", { name: /^Confirm: approve this step/i }).click();
  await expect(question.getByRole("form", { name: "Confirm it's you" })).toBeVisible();
  // being asked for the code answers nothing
  await page.reload();
  await expect(asking(page)).toBeVisible();

  await asking(page).getByRole("button", { name: "Approve this step" }).click();
  const again = mailCount();
  await asking(page).getByRole("button", { name: /^Confirm: approve this step/i }).click();
  const code = await mailTo(OWNER, "step-up", again);
  const box = asking(page).getByRole("form", { name: "Confirm it's you" });
  await box.getByPlaceholder("Six-digit code").fill(code.meta!.code!);
  await box.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(asking(page)).toHaveCount(0);
});
