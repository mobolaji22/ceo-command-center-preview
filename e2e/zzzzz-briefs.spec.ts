import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";
import { openClientDesk, openClientProject } from "./client-room";

/**
 * What people are told (CC-5). A client reads what was written to them, opens the records behind a statement and has every one of
 * them checked; a gap says it is not recorded. People say how they want to be told, on the client's page and on the CEO's phone, and
 * it is still there after a reload. Runs after the runs spec, whose approved plans and stopped work produced the briefs read here.
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
evidence(test);
test.beforeEach(() => forgetSignInRequests());

test("a client reads a brief, opens the records behind a statement, and has every source checked", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/client");
  await openClientDesk(page, "Lamp");
  const archive = page.getByLabel("Briefs", { exact: true });
  await expect(archive.locator(".brief-row").first()).toBeVisible();
  const kickoff = archive.locator(".brief-row", { hasText: "WHAT WE WILL DO" }).first();
  await kickoff.getByRole("button", { name: /^Read / }).click();

  const brief = kickoff.getByRole("article");
  await expect(brief.locator(".brief-statement").first()).toBeVisible();
  // the records behind a statement are a click away, and hidden until then
  const fact = brief.locator(".brief-statement:not(.gap)").first();
  await expect(fact.getByLabel("Where this comes from", { exact: true })).toHaveCount(0);
  await fact.getByRole("button", { name: /^Show where this comes from/ }).click();
  await expect(fact.getByLabel("Where this comes from", { exact: true }).locator("li").first()).toBeVisible();
  await shot(page, "A brief: each statement has the records it comes from a click away");
  await fact.getByRole("button", { name: /^Hide where this comes from/ }).click();
  await expect(fact.getByLabel("Where this comes from", { exact: true })).toHaveCount(0);

  // what is not known says so, and has no sources to open
  const gap = brief.locator(".brief-statement.gap").first();
  if (await gap.count()) { await expect(gap).toContainText("not recorded."); await expect(gap.getByRole("button")).toHaveCount(0); }

  await brief.getByRole("button", { name: "Check every source" }).click();
  await expect(brief.getByRole("status")).toContainText("Every statement matches its records");
  await shot(page, "Every source of the brief is opened again and checked");
  await kickoff.getByRole("button", { name: /^Close / }).click();
  await expect(kickoff.getByRole("article")).toHaveCount(0);
});

test("a client sets quiet hours and a weekly digest, cannot make a lower level interrupt, and finds it kept after a reload", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/client");
  await openClientDesk(page, "Lamp", "How you are told");
  const form = page.getByRole("form", { name: "How you are told" });
  // only 3 and above can interrupt: nothing lower is offered
  await expect(form.getByLabel("Interrupt me for", { exact: true }).locator("option")).toHaveText(["Important and above", "Urgent and above", "Only emergencies"]);

  await form.getByLabel("Quiet hours", { exact: true }).check();
  await form.getByLabel("From", { exact: true }).fill("21:30");
  await form.getByLabel("Until", { exact: true }).fill("06:45");
  await form.getByLabel("Interrupt me for", { exact: true }).selectOption("4");
  await form.getByLabel("Digest", { exact: true }).selectOption("WEEKLY");
  await form.getByLabel("On", { exact: true }).selectOption("5");
  await form.getByLabel("At", { exact: true }).fill("09:15");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByRole("status")).toHaveText("Saved.");

  await page.reload();
  await openClientDesk(page, "Lamp", "How you are told");
  const again = page.getByRole("form", { name: "How you are told" });
  await expect(again.getByLabel("Quiet hours", { exact: true })).toBeChecked();
  await expect(again.getByLabel("From", { exact: true })).toHaveValue("21:30");
  await expect(again.getByLabel("Until", { exact: true })).toHaveValue("06:45");
  await expect(again.getByLabel("Interrupt me for", { exact: true })).toHaveValue("4");
  await expect(again.getByLabel("Digest", { exact: true })).toHaveValue("WEEKLY");
  await expect(again.getByLabel("On", { exact: true })).toHaveValue("5");
  await expect(again.getByLabel("At", { exact: true })).toHaveValue("09:15");
});

test("a quiet hours window with the same start and end is refused in words, and nothing is changed", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/client");
  await openClientDesk(page, "Lamp", "How you are told");
  const form = page.getByRole("form", { name: "How you are told" });
  await form.getByLabel("From", { exact: true }).fill("08:00");
  await form.getByLabel("Until", { exact: true }).fill("08:00");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByRole("alert")).toContainText("different end");
  await page.reload();
  await openClientDesk(page, "Lamp", "How you are told");
  await expect(page.getByRole("form", { name: "How you are told" }).getByLabel("From", { exact: true })).toHaveValue("21:30");
});

test("the CEO reads every client's briefs on the brief desk, and sets how they are told on the phone", async ({ page }) => {
  await signIn(page, CEO);
  await page.getByRole("button", { name: "Preview Brief" }).click();
  await page.getByRole("button", { name: "Review full brief" }).click();
  const archive = page.getByLabel("Briefs", { exact: true });
  await expect(archive.locator(".brief-row").first()).toBeVisible();
  await archive.locator(".brief-row").first().getByRole("button", { name: /^Read / }).click();
  await expect(archive.getByRole("article").first().locator(".brief-statement").first()).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Preview Phone" }).click();
  await page.getByRole("button", { name: "Open phone" }).click();
  await page.getByRole("button", { name: /^How you are told/ }).click();
  const form = page.getByRole("form", { name: "How you are told" });
  await form.getByLabel("Digest", { exact: true }).selectOption("OFF");
  await expect(form.getByLabel("At", { exact: true })).toHaveCount(0);
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByRole("status")).toHaveText("Saved.");

  await page.reload();
  await page.getByRole("button", { name: "Preview Phone" }).click();
  await page.getByRole("button", { name: "Open phone" }).click();
  await page.getByRole("button", { name: /^How you are told/ }).click();
  await expect(page.getByRole("form", { name: "How you are told" }).getByLabel("Digest", { exact: true })).toHaveValue("OFF");
});
