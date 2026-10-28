import { newDirective } from "./directive";
import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";
import { openClientDesk } from "./client-room";
import { expectRoomHeldStill } from "./still";

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
  await page.getByRole("button", { name: "Computer", exact: true }).click();
  await expect(page.getByText(/\d+ projects · \d+ tasks · \d+ decisions on record/)).toBeVisible();
  await expect(page.locator(".dossier-row").first()).toBeVisible();
  await expectRoomHeldStill(page);
  await page.getByRole("button", { name: /Open case file for/ }).first().click();
  await expect(page.getByRole("region", { name: "Case file" }).first()).toBeVisible();
  await shot(page, "The Computer: every case, with the work in order and the budget used in its case file");

  // contracts desk
  await page.goto("/");
  await page.getByRole("button", { name: "Contracts", exact: true }).click();
  await expect(page.locator(".contracts-desk").getByText("QUESTIONS FROM THE WORK")).toBeVisible();
  await expect(page.locator(".contracts-desk").getByText("PLANS AWAITING A SIGNATURE")).toBeVisible();
  await shot(page, "The contracts desk: what the work is asking, and the plans waiting for a signature");

  // phone
  await page.goto("/");
  await page.getByRole("button", { name: "Phone", exact: true }).click();
  await expect(page.getByText("Questions From The Work")).toBeVisible();
  await page.getByRole("button", { name: /^How you are told/ }).click();
  await expect(page.getByRole("form", { name: "How you are told" })).toBeVisible();
  await shot(page, "The phone: what is pressing, the briefs told, and how the CEO wants to be told");

  // directive desk
  await page.goto("/");
  await page.getByRole("button", { name: "Directive", exact: true }).click();
  // The work first; a new directive is a button, and the form can be put away (P6.21). A draft is never discarded unasked.
  await expect(page.getByRole("button", { name: "New directive", exact: true })).toBeVisible();
  const composer = await newDirective(page);
  await composer.getByRole("button", { name: "Close without sending" }).click();
  await expect(page.getByLabel("New request")).toHaveCount(0);
  const again = await newDirective(page);
  await again.getByLabel("WHAT WOULD YOU LIKE DONE?").fill("A draft");
  await again.getByRole("button", { name: "Close without sending" }).click();
  await expect(again.getByText("Discard what you wrote?")).toBeVisible();
  await again.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByLabel("New request")).toHaveCount(0);
  await expect(page.locator(".directive-row").first()).toBeVisible();
  await shot(page, "The directive desk: requests sorted by what they need, for a client or for the agency itself");

  // brief desk
  await page.goto("/");
  await page.getByRole("button", { name: "Brief", exact: true }).click();
  await expect(page.getByText("EVERYTHING YOU HAVE BEEN TOLD")).toBeVisible();
  await expect(page.getByLabel("Briefs", { exact: true }).locator(".brief-row").first()).toBeVisible();
  await shot(page, "The brief desk: what happened while the CEO was away, and every brief with its sources");

  // corridor and manage
  await page.goto("/");
  await page.getByRole("button", { name: "Door", exact: true }).click();
  await expect(page.locator(".door-card")).toHaveCount(13);
  await shot(page, "The corridor: the thirteen domains, in five wings");
  // The records: from the corridor's "See all projects".
  await page.getByRole("button", { name: /SEE ALL PROJECTS/ }).click();
  await expect(page.getByRole("tab", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Library", exact: true })).toBeVisible();
  await shot(page, "Records: the projects and the library");
  // Settings: from the header.
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  for (const s of ["Pricing", "Model spend", "How the agency runs", "Notifications", "People and access", "Your sessions"]) await expect(page.getByRole("tab", { name: s, exact: true })).toBeVisible();
  await shot(page, "Settings: pricing, model spend, how the agency runs, notifications, access and sessions");
});

test("a client's room and everything in it", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/client");
  await expect(page.getByRole("heading", { name: /The client room/ })).toBeVisible();
  await shot(page, "The client room: a table, a screen, a board, a shelf and a lamp to press");
  // every layer of what a client used to scroll through is one tab on one desk
  const layers: [Parameters<typeof openClientDesk>[1], string | undefined, string][] = [
    ["Table", undefined, "Your projects"],
    ["Table", "Timeline", "TIMELINE"],
    ["Screen", undefined, "NEEDS YOUR SIGNATURE"],
    ["Board", undefined, "YOUR REQUESTS"],
    ["Board", "Questions from the work", "Questions from the work"],
    ["Shelf", "Your library", "Your library"],
    ["Lamp", undefined, "Briefs"],
    ["Lamp", "Standing permission", "Standing permission"],
    ["Lamp", "How you are told", "How you are told"],
  ];
  for (const [desk, tab, expected] of layers) {
    await openClientDesk(page, desk, tab);
    await expect(page.getByText(expected, { exact: false }).first()).toBeVisible();
  }
  await openClientDesk(page, "Board", "Your requests");
  await shot(page, "A client's board: their requests, with the questions from the work on the next tab");
  await openClientDesk(page, "Table");
  await expectRoomHeldStill(page);
  await page.getByRole("tab", { name: /^Projects/ }).click();
  const room = page.locator(".project-room").first();
  await room.getByRole("button", { name: /^Show progress of/i }).click();
  await expect(room.getByLabel("Case file")).toBeVisible();
  await shot(page, "A client's project opened: the work in order, the budget used, and the hand on the brake");
});
