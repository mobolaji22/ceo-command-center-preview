import { expect, test, type Page } from "@playwright/test";
import { actionLinksFor, aClientBriefId, forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";

/**
 * The two pages an email opens (CC-5b). A question can be answered from the email without signing in, but only by pressing the
 * button: opening the page, even again and again as a mail scanner would, answers nothing, and the link works once. A link to a brief
 * asks you to sign in and then brings you to the brief, not to the home page. Runs after the briefs spec.
 */
const OWNER = "owner@orbit.example";

async function signInFrom(page: Page, email: string) {
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

test("a client resumes held work from the email: opening answers nothing, the button answers once", async ({ browser, page }) => {
  // the owner holds their own work, which is a question only they can lift
  await signInFrom(page, OWNER);
  await page.goto("/client");
  const room = page.locator(".project-room", { hasText: /checkout/i }).first();
  await room.getByRole("button", { name: /^Show progress of/i }).click();
  const file = room.getByLabel("Case file");
  await file.getByRole("button", { name: "Hold the work" }).click();
  await file.getByRole("button", { name: "Confirm: hold the work" }).click();
  await expect(file.locator(".pill").first()).toHaveText("PAUSED");

  const [link] = actionLinksFor("checkout", OWNER);
  expect(link?.option).toBe("RESUME");

  // someone with only the email: no session
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(`/act/${link!.token}`);
  await expect(stranger.getByRole("heading", { name: /paused/i })).toBeVisible();
  await expect(stranger.getByLabel("What happens if you confirm")).toContainText("Resume the work");
  await shot(stranger, "The page an emailed link opens: the question and what answering would do, nothing answered yet");
  await expect(stranger.getByText("Nothing happens until you confirm.")).toBeVisible();
  // opened again and again, as a mail scanner would: still nothing
  await stranger.reload();
  await stranger.reload();
  await expect(stranger.getByRole("button", { name: "Confirm: resume the work" })).toBeVisible();
  await page.reload();
  await room.getByRole("button", { name: /^Show progress of/i }).click();
  await expect(room.getByLabel("Case file").locator(".pill").first()).toHaveText("PAUSED");

  await stranger.getByRole("button", { name: "Confirm: resume the work" }).click();
  await expect(stranger.getByRole("heading", { name: "Done." })).toBeVisible();
  await shot(stranger, "Pressing the button answered it, as the person the link was sent to");
  await page.reload();
  await room.getByRole("button", { name: /^Show progress of/i }).click();
  await expect(room.getByLabel("Case file").locator(".pill").first()).toHaveText("UNDER WAY");

  // it works once
  await stranger.goto(`/act/${link!.token}`);
  await expect(stranger.getByRole("heading", { name: "This link has already been used." })).toBeVisible();
  await shot(stranger, "The same link, used again: refused");
  await expect(stranger.getByRole("button", { name: /^Confirm/ })).toHaveCount(0);
  await stranger.context().close();
});

test("a link that is not ours says so and offers nothing", async ({ page }) => {
  await page.goto("/act/dpa_notalink.0000");
  await expect(page.getByRole("heading", { name: "This link isn't valid." })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Confirm/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("a link to a brief asks for sign-in, then brings the person to the brief", async ({ page }) => {
  const id = aClientBriefId();
  expect(id).not.toBe("");
  await page.goto(`/briefs/${id}`);
  await page.waitForURL(/\/auth/);
  await signInFrom(page, OWNER);
  await expect(page).toHaveURL(new RegExp(`/briefs/${id}$`));
  await expect(page.getByRole("article")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check every source" })).toBeVisible();
  await page.getByRole("button", { name: "Check every source" }).click();
  await expect(page.getByRole("status")).toContainText("Every statement matches its records");

  // the destination is remembered once: signing in again goes home
  await page.getByRole("link", { name: "BACK TO THE COMMAND CENTER" }).click();
  await expect(page).toHaveURL(/\/client$/);
});
