import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests, recordSpend } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";
import { openClientDesk, openClientProject } from "./client-room";

/**
 * The work, in the agency (CC-4). The client sees how their project is going in their own room: the work in order, how much of
 * the approved budget it has used, and what it is asking them; they can hold it, resume it and stop it. The CEO sees the same
 * case file on the computer and the questions on the contracts desk, and can hold work for any client; only the side that held
 * can lift it. Runs after plans (which approved the two plans this works on).
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

const room = (page: Page, word: RegExp) => page.locator(".project-room", { hasText: word }).first();
async function openProgress(page: Page, word: RegExp) {
  await openClientProject(page, word);
  const r = room(page, word);
  await r.getByRole("button", { name: /^Show progress of/i }).click();
  return r.getByLabel("Case file");
}

test.describe.configure({ mode: "serial" });
evidence(test);
test.beforeEach(() => forgetSignInRequests());

test("a client sees the work in order and the budget used, holds it, resumes it, and stops it", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/client");
  const file = await openProgress(page, /checkout/i);

  await expect(room(page, /checkout/i).locator(".pill").first()).toHaveText("UNDER WAY");
  await expect(file.getByLabel("The work, in order").locator("li").first()).toBeVisible();
  await expect(file.getByLabel("Budget used", { exact: true })).toContainText(/\$0\.00 of \$\d+\.\d\d approved \(0%\)/);
  recordSpend("%checkout%", 0.5);
  await page.reload();
  const again = await openProgress(page, /checkout/i);
  await expect(again.getByLabel("Budget used", { exact: true })).toContainText(/\$0\.50 of \$\d+\.\d\d approved/);
  await expect(again.getByRole("progressbar", { name: "Share of the approved budget used" })).toBeVisible();
  await shot(page, "The client sees the work in order and how much of the approved budget it has used");
  // the client sees totals, never the records behind them
  await expect(again).not.toContainText("e2e");

  // hold the work: nothing new starts, and the pause is a question only this side can lift
  await again.getByRole("button", { name: "Hold the work" }).click();
  await again.getByLabel("Why (optional)").fill("Waiting for our board");
  await again.getByRole("button", { name: "Confirm: hold the work" }).click();
  await expect(again.getByRole("status").first()).toContainText("on hold");
  await expect(again.locator(".pill").first()).toHaveText("PAUSED");
  const pause = again.getByLabel("The work is paused");
  await expect(pause).toContainText("Waiting for our board");
  await pause.getByRole("button", { name: "Resume the work" }).click();
  await pause.getByRole("button", { name: "Confirm: resume the work" }).click();
  await expect(again.locator(".pill").first()).toHaveText("UNDER WAY");
  await expect(again.getByLabel("The work is paused")).toHaveCount(0);
});

test("the CEO's hold on a client's work is shown to the client, who cannot lift it; the CEO can", async ({ browser, page }) => {
  const ceoPage = await (await browser.newContext()).newPage();
  await signIn(ceoPage, CEO);
  await ceoPage.getByRole("button", { name: "Preview Computer" }).click();
  await ceoPage.getByRole("button", { name: "Open operating system" }).click();
  await ceoPage.getByRole("button", { name: /Open case file for .*checkout/i }).click();
  const ceoFile = ceoPage.getByRole("region", { name: "Case file" }).first();
  await expect(ceoFile.getByLabel("Budget used", { exact: true })).toContainText(/\$0\.50 of/);
  await ceoFile.getByRole("button", { name: "Hold the work" }).click();
  await ceoFile.getByLabel("Why (optional)").fill("Checking a detail with legal");
  await ceoFile.getByRole("button", { name: "Confirm: hold the work" }).click();
  await expect(ceoFile.locator(".pill").first()).toHaveText("PAUSED");

  // the client is told, by whom, and cannot lift it
  await signIn(page, OWNER);
  await page.goto("/client");
  const file = await openProgress(page, /checkout/i);
  const pause = file.getByLabel("The work is paused");
  await expect(pause).toContainText("paused by the agency");
  await expect(pause).toContainText("Checking a detail with legal");
  await pause.getByRole("button", { name: "Resume the work" }).click();
  await pause.getByRole("button", { name: "Confirm: resume the work" }).click();
  await expect(pause.getByRole("status")).toContainText("don't have access");
  await expect(file.locator(".pill").first()).toHaveText("PAUSED");

  // the CEO lifts it from the contracts desk, where the work's questions are
  await ceoPage.goto("/");
  await ceoPage.getByRole("button", { name: "Preview Contracts" }).click();
  await ceoPage.getByRole("button", { name: "Review contracts", exact: true }).click();
  const desk = ceoPage.locator(".contracts-desk");
  await expect(desk.getByText("QUESTIONS FROM THE WORK")).toBeVisible();
  const q = desk.getByLabel("The work is paused").first();
  await expect(q).toContainText("Asked of you");
  await q.getByRole("button", { name: "Resume the work" }).click();
  await q.getByRole("button", { name: "Confirm: resume the work" }).click();
  await expect(desk.getByLabel("The work is paused")).toHaveCount(0);

  await page.reload();
  await openClientProject(page, /checkout/i);
  await expect(room(page, /checkout/i).locator(".pill").first()).toHaveText("UNDER WAY");
  await ceoPage.context().close();
});

test("stopping the work is final, and says so first", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/client");
  const file = await openProgress(page, /pricing/i);
  await file.getByRole("button", { name: "Stop the work" }).click();
  await expect(file.getByText(/ends the work for good/)).toBeVisible();
  await file.getByRole("button", { name: "Confirm: stop the work" }).click();
  await expect(file.locator(".pill").first()).toHaveText("STOPPED");
  await expect(file.getByRole("button", { name: "Hold the work" })).toHaveCount(0);
  await expect(file.getByRole("button", { name: "Stop the work" })).toHaveCount(0);
});
