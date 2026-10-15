import { expect, test, type Page } from "@playwright/test";
import { askAboutAnObjection, forgetSignInRequests, stopRunAtBudget, withdrawQuestion } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";
import { openClientDesk, openClientProject } from "./client-room";

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
evidence(test);
test.beforeEach(() => forgetSignInRequests());

test("approving a step outside the plan asks the client's owner for the emailed code, and nothing changes until it is right", async ({ page }) => {
  const stopped = stopRunAtBudget("checkout");
  expect(stopped.reason).toBe("AWAITING_APPROVAL");
  const asking = (p: Page) => p.getByRole("article", { name: /^Your go-ahead is needed/ });

  await signIn(page, OWNER);
  await page.goto("/client");
  await openClientDesk(page, "Board", /Questions/);
  const question = asking(page);
  await expect(question).toBeVisible();
  // The warning follows the API's word on the chosen answer: stopping needs no code, approving does.
  await question.getByRole("button", { name: "Stop the work" }).click();
  await expect(question.getByText("we will ask you for a six-digit code")).toHaveCount(0);
  await question.getByRole("button", { name: "Approve this step" }).click();
  await expect(question.getByText("we will ask you for a six-digit code")).toBeVisible();
  await question.getByRole("button", { name: /^Confirm: approve this step/i }).click();
  await expect(question.getByRole("form", { name: "Confirm it's you" })).toBeVisible();
  await shot(page, "Approving a step outside the plan asks for the emailed code first");
  // being asked for the code answers nothing
  await page.reload();
  await openClientDesk(page, "Board", /Questions/);
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

test("letting work stand over another department's objection warns of the code and is refused without it; redoing it does not warn", async ({ page }) => {
  const title = "Another department objects to this work";
  const id = askAboutAnObjection("%checkout%", title);
  try {
    const asking = (p: Page) => p.getByRole("article", { name: title });
    await signIn(page, OWNER);
    await page.goto("/client");
    await openClientDesk(page, "Board", /Questions/);
    const question = asking(page);
    await expect(question).toBeVisible();

    await question.getByRole("button", { name: "Redo the work" }).click();
    await expect(question.getByText("we will ask you for a six-digit code")).toHaveCount(0);
    await question.getByRole("button", { name: "Let the work stand over the objection" }).click();
    await expect(question.getByText("we will ask you for a six-digit code")).toBeVisible();
    await expect(question.getByLabel("Why should the work stand? It is recorded with your name.")).toBeVisible();

    // Showing the warning enforces nothing; the API does. Confirming without a fresh code is refused and the box appears.
    const before = mailCount();
    await question.getByRole("button", { name: /^Confirm: let the work stand/i }).click();
    await expect(question.getByRole("form", { name: "Confirm it's you" })).toBeVisible();
    await mailTo(OWNER, "step-up", before);
    await shot(page, "Letting work stand over an objection asks for the emailed code first");
    await page.reload();
    await openClientDesk(page, "Board", /Questions/);
    await expect(asking(page)).toBeVisible();
  } finally {
    withdrawQuestion(id);
  }
});
