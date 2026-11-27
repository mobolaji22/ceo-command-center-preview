import { newDirective } from "./directive";
import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";
import { openClientDesk } from "./client-room";
import { expectRoomHeldStill } from "./still";
import { openFromStudio, studioHeading } from "./studio";
import { ARRIVAL_KEY } from "../src/components/cc/lobby-arrival";

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

test("the CEO's studio and every desk it opens", async ({ page }) => {
  await signIn(page, CEO);
  await expect(studioHeading(page)).toBeVisible();
  await expect(page.getByText(/waiting on your pen|Nothing waits on your pen/).first()).toBeVisible();

  // the work in detail (once the Computer): the cases, each with its case file
  await openFromStudio(page, "detail");
  await expect(page.getByText(/\d+ projects · \d+ tasks · \d+ decisions on record/)).toBeVisible();
  await expect(page.locator(".dossier-row").first()).toBeVisible();
  await expectRoomHeldStill(page);
  await page.getByRole("button", { name: /Open case file for/ }).first().click();
  await expect(page.getByRole("region", { name: "Case file" }).first()).toBeVisible();
  await shot(page, "The work in detail: every case, with the work in order and the budget used in its case file");

  // everything to sign
  await page.goto("/");
  await openFromStudio(page, "sign");
  await expect(page.locator(".contracts-desk").getByText("QUESTIONS FROM THE WORK")).toBeVisible();
  await expect(page.locator(".contracts-desk").getByText("PLANS AWAITING A SIGNATURE")).toBeVisible();
  await shot(page, "Everything to sign: what the work is asking, and the plans waiting for a signature");

  // your requests
  await page.goto("/");
  await openFromStudio(page, "requests");
  // The work first; a new directive is a button, and the form can be put away (P6.21). A draft is never discarded unasked.
  await expect(page.getByRole("button", { name: "New project", exact: true })).toBeVisible();
  const composer = await newDirective(page);
  await composer.getByRole("button", { name: "Close without sending" }).click();
  await expect(page.getByLabel("New request")).toHaveCount(0);
  const again = await newDirective(page);
  await again.getByLabel("WHAT WOULD YOU LIKE DONE?").fill("A draft");
  await again.getByRole("button", { name: "Close without sending" }).click();
  await expect(again.getByText("Discard what you wrote?")).toBeVisible();
  await again.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByLabel("New request")).toHaveCount(0);
  await expect(page.locator(".thread-row").first()).toBeVisible();
  await shot(page, "Your requests: projects and their threads, for a client or for the studio itself");

  // what changed
  await page.goto("/");
  await openFromStudio(page, "brief");
  await expect(page.getByText("EVERYTHING YOU HAVE BEEN TOLD")).toBeVisible();
  await expect(page.getByLabel("Briefs", { exact: true }).locator(".brief-row").first()).toBeVisible();
  await shot(page, "What changed: what happened while the CEO was away, and every brief with its sources");

  // records
  await page.goto("/");
  await openFromStudio(page, "records");
  await expect(page.getByRole("tab", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Library", exact: true })).toBeVisible();
  await shot(page, "Records: the projects and the library");
  // Settings: from the header.
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  for (const s of ["Pricing", "Model spend", "How the agency runs", "Notifications", "People and access", "Your sessions"]) await expect(page.getByRole("tab", { name: s, exact: true })).toBeVisible();
  await shot(page, "Settings: pricing, model spend, how the agency runs, notifications, access and sessions");
});

type Studio = {
  decide: { count: number; items: { kind: string; id: string; projectId: string | null }[] };
  know: { count: number };
  board: { engagements: number; needsYou: number; held: number };
};
type Floor = { groups: { name: string; kind: "CLIENT" | "INTERNAL"; studioOwn: boolean; engagements: { projectId: string; needsYou: number; held: number }[] }[] };

/**
 * The CEO's walk (v4 ADR-0099, slice 4.2's proof): from the studio into every card and across the Floor's groups, every number on the
 * way being v4's and being what pressing it finds. The test reads v4 once and compares; it holds no counts of its own.
 */
test("the CEO walks the studio: each card's count is v4's and is what opening it finds, and the Floor holds every group", async ({ page }) => {
  await signIn(page, CEO);
  const studio = (await (await page.request.get("/api/v4/v1/studio")).json()) as Studio;
  const floor = (await (await page.request.get("/api/v4/v1/floor")).json()) as Floor;
  const overview = (await (await page.request.get("/api/v4/v1/console/overview")).json()) as { intents: { questions: { id: string }[] }[] };
  await expect(studioHeading(page)).toBeVisible();
  await shot(page, "The studio: the bench, Decide, Know and Board, and the composer");

  // Decide: the count is v4's, the header says the same, and the list holds every item (five shown, the rest counted).
  const decide = page.locator(".dock-decide");
  const n = studio.decide.count;
  await expect(decide.locator(".dock-card-line")).toHaveText(n ? `${n} waiting on your pen` : "Nothing waits on your pen.");
  await expect(page.locator(".topbar").getByText(n ? `${n} waiting on your pen` : "Nothing waits on your pen")).toBeVisible();
  await expect(decide.locator(".decide-item")).toHaveCount(Math.min(n, 5));
  if (n > 5) await expect(decide.locator(".decide-more")).toHaveText(`${n - 5} more`);
  // Each item opens where it is dealt with: a request's question in your requests, the rest to sign at the desk, a stop in detail.
  const asked = new Set(overview.intents.flatMap((i) => i.questions.map((q) => q.id)));
  for (const [i, item] of studio.decide.items.slice(0, 5).entries()) {
    const surface = item.kind === "QUESTION" && asked.has(item.id) ? "directive" : ["APPROVAL", "PLAN", "QUESTION"].includes(item.kind) ? "contracts" : "computer";
    await decide.locator(".decide-item").nth(i).click();
    await expect(page.locator(`.desk-panel[data-surface="${surface}"]`)).toBeVisible();
    await page.getByRole("button", { name: "BACK TO THE STUDIO" }).click();
  }

  // Know: v4's count of what happened since the last look, and it opens the brief.
  const know = page.locator(".dock-know");
  await expect(know.locator(".dock-card-count")).toHaveText(String(studio.know.count));
  await know.getByRole("button", { name: "Read what changed" }).click();
  await expect(page.locator('.desk-panel[data-surface="brief"]')).toBeVisible();
  await page.getByRole("button", { name: "BACK TO THE STUDIO" }).click();

  // Board: its three numbers are the Floor's open rows, the open rows for you, and the open rows held (a closed one is shown, not counted).
  const board = page.locator(".dock-board");
  await expect(board.locator(".dock-card-line")).toHaveText(`${studio.board.engagements} on the bench`);
  await board.getByRole("button", { name: "Walk the Floor" }).click();
  await expect(page.locator(".workspace-path")).toContainText("The Floor");
  const rows = page.locator(".floor-row:not(.floor-closed)");
  await expect(rows).toHaveCount(studio.board.engagements);
  await shot(page, "The Floor: every engagement, grouped by client, the studio's own and your work, with a mark for each room");
  await page.getByRole("button", { name: "For you", exact: true }).click();
  await expect(rows).toHaveCount(studio.board.needsYou);
  await page.getByRole("button", { name: "Held", exact: true }).click();
  await expect(rows).toHaveCount(studio.board.held);
  await page.getByRole("button", { name: "Everything", exact: true }).click();

  // The Floor's groups are v4's, in v4's order: each client by name, the studio's own, and your work.
  const name = (g: Floor["groups"][number]) => (g.kind === "CLIENT" ? g.name : g.studioOwn ? "The studio's own" : "Your work");
  await expect(page.locator(".floor-group-name")).toHaveText(floor.groups.map(name));
  expect(floor.groups.some((g) => g.kind === "CLIENT"), "a client's work is on the Floor").toBe(true);
  expect(floor.groups.some((g) => g.studioOwn), "the studio's own work is on the Floor").toBe(true);
  for (const [i, g] of floor.groups.entries()) await expect(page.locator(".floor-group").nth(i).locator(".floor-row")).toHaveCount(g.engagements.length);

  // A row's name opens its records; a room's mark opens that room.
  await page.locator(".floor-row").first().locator(".floor-name").click();
  await expect(page.locator('.desk-panel[data-surface="manage"]')).toBeVisible();
});

// The arrival from the lobby is an entrance, not part of the room: a desk opened while it plays ends it, so it never draws over the
// desk or keeps the room moving behind it. Its iris is slowed here so the desk certainly opens mid-arrival; at its real 0.9 s this
// was a race the tour above lost on a fast runner.
test("a desk opened while the room is still arriving from the lobby ends the arrival", async ({ page }) => {
  await signIn(page, CEO);
  await page.addInitScript((key) => {
    sessionStorage.setItem(key, "lobby");
    addEventListener("DOMContentLoaded", () => {
      const slow = document.createElement("style");
      slow.textContent = ".lobby-arrival { animation-duration: 60s !important; }";
      document.head.append(slow);
    });
  }, ARRIVAL_KEY);
  await page.goto("/");
  await expect(page.locator(".lobby-arrival")).toHaveCount(1);
  await openFromStudio(page, "detail");
  await expect(page.locator(".lobby-arrival")).toHaveCount(0);
  await expectRoomHeldStill(page);
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
    ["Board", undefined, "All threads"],
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
  await openClientDesk(page, "Board", "Your projects");
  await shot(page, "A client's board: their projects and threads, with the questions from the work on the next tab");
  await openClientDesk(page, "Table");
  await expectRoomHeldStill(page);
  await page.getByRole("tab", { name: /^Projects/ }).click();
  const room = page.locator(".project-room").first();
  await room.getByRole("button", { name: /^Show progress of/i }).click();
  await expect(room.getByLabel("Case file")).toBeVisible();
  await shot(page, "A client's project opened: the work in order, the budget used, and the hand on the brake");
});
