import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";

/**
 * The tour: every screen the CEO and a client have, opened once the whole journey has run, each shown to be connected to real records
 * and not blank. It is the last word on "is it all wired": if a screen lost its data source, this is where it shows.
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

test("the CEO's office and every desk in it", async ({ page }) => {
  await signIn(page, CEO);
  await expect(page.getByRole("heading", { name: /The command center/ })).toBeVisible();
  await expect(page.getByText(/projects · \d+ awaiting your signature/)).toBeVisible();

  // computer: the cases, each with its case file
  await page.getByRole("button", { name: "Preview Computer" }).click();
  await page.getByRole("button", { name: "Open operating system" }).click();
  await expect(page.getByText(/\d+ projects · \d+ tasks · \d+ decisions on record/)).toBeVisible();
  await expect(page.locator(".dossier-row").first()).toBeVisible();
  await page.getByRole("button", { name: /Open case file for/ }).first().click();
  await expect(page.getByRole("region", { name: "Case file" }).first()).toBeVisible();
  await shot(page, "The Computer: every case, with the work in order and the budget used in its case file");

  // contracts desk
  await page.goto("/");
  await page.getByRole("button", { name: "Preview Contracts" }).click();
  await page.getByRole("button", { name: "Review contracts", exact: true }).click();
  await expect(page.locator(".contracts-desk").getByText("QUESTIONS FROM THE WORK")).toBeVisible();
  await expect(page.locator(".contracts-desk").getByText("PLANS AWAITING A SIGNATURE")).toBeVisible();
  await shot(page, "The contracts desk: what the work is asking, and the plans waiting for a signature");

  // phone
  await page.goto("/");
  await page.getByRole("button", { name: "Preview Phone" }).click();
  await page.getByRole("button", { name: "Open phone" }).click();
  await expect(page.getByText("Questions From The Work")).toBeVisible();
  await page.getByRole("button", { name: /^How you are told/ }).click();
  await expect(page.getByRole("form", { name: "How you are told" })).toBeVisible();
  await shot(page, "The phone: what is pressing, the briefs told, and how the CEO wants to be told");

  // directive desk
  await page.goto("/");
  await page.getByRole("button", { name: "Preview Directive" }).click();
  await page.getByRole("button", { name: "Compose directive" }).click();
  await expect(page.getByLabel("New request")).toBeVisible();
  await expect(page.locator(".intent-card").first()).toBeVisible();
  await shot(page, "The directive desk: send a request to a client, and every request with its plan and where it stands");

  // brief desk
  await page.goto("/");
  await page.getByRole("button", { name: "Preview Brief" }).click();
  await page.getByRole("button", { name: "Review full brief" }).click();
  await expect(page.getByText("EVERYTHING YOU HAVE BEEN TOLD")).toBeVisible();
  await expect(page.getByLabel("Briefs", { exact: true }).locator(".brief-row").first()).toBeVisible();
  await shot(page, "The brief desk: what happened while the CEO was away, and every brief with its sources");

  // corridor and manage
  await page.goto("/");
  await page.getByRole("button", { name: "Preview Door" }).click();
  await page.getByRole("button", { name: "Enter corridor" }).click();
  await expect(page.locator(".door-card")).toHaveCount(9);
  await shot(page, "The corridor: the nine departments");
  await page.goto("/");
  await page.getByRole("button", { name: "Manage records and clients" }).click();
  await expect(page.getByRole("tab", { name: "Organizations" })).toBeVisible();
  await shot(page, "Manage: clients, people, and the library");
});

test("a client's room and everything in it", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/client");
  await expect(page.getByRole("heading", { name: /Your projects/ })).toBeVisible();
  for (const section of ["YOUR REQUESTS", "PROJECTS", "STANDING PERMISSION", "BRIEFS", "HOW YOU ARE TOLD", "QUESTIONS FROM THE WORK", "NEEDS YOUR SIGNATURE", "YOUR LIBRARY", "TIMELINE"]) {
    await expect(page.getByText(section, { exact: true }).first()).toBeVisible();
  }
  await shot(page, "A client's room: their requests, projects, standing permission, briefs, questions and library");
  const room = page.locator(".project-room").first();
  await room.getByRole("button", { name: /^Show progress of/i }).click();
  await expect(room.getByLabel("Case file")).toBeVisible();
  await shot(page, "A client's project opened: the work in order, the budget used, and the hand on the brake");
});
