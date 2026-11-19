import { expect, test, type Locator, type Page } from "@playwright/test";
import { approvedDesignProject, forgetSignInRequests, runStudioRenders, seedCopyDeck } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";

/**
 * The Media studio (dev-playbook-v4 ADR-0081 Decision 13, Order step 4), on the design the Workshop journey approved. Design locks an
 * element and the client approves that version; with Content's copy deck in place (a stand-in, e2e/copy-seed.mjs), the CEO opens the
 * Workshop's Motion bench, starts a piece from v4's first cut and plays v4's preview. Moving the locked element is refused by v4 and
 * goes to Design as a change request on it, in the Workshop's own feedback. A free edit (a shorter opening) is saved, rendered by v4's
 * renderer (the worker's sweep, run by e2e/media-render.mjs) and passed by Design's check, read from the file itself.
 * Runs after the Workshop journey (it needs its approved design), before the client's book and the phone pass.
 */
const CEO = "ceo@agency.example";
const OWNER = "owner@orbit.example";
const LOCKED = "Lead headline";

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

let project = { id: "", name: "" };
test.beforeAll(() => { project = approvedDesignProject(); });

async function openWorkshop(page: Page, who: "ceo" | "client"): Promise<Locator> {
  if (who === "ceo") {
    await page.goto("/?room=DESIGN&spot=workshop");
    const picker = page.getByLabel("Design project");
    if (await picker.count()) await picker.selectOption({ label: project.name });
  } else {
    await page.goto(`/client?desk=design&project=${encodeURIComponent(project.id)}`);
  }
  const ws = page.locator('[data-desk="workshop"]');
  await expect(ws).toBeVisible();
  return ws;
}

async function openStudio(page: Page): Promise<Locator> {
  await openWorkshop(page, "ceo");
  await page.getByRole("group", { name: "Bench" }).getByRole("button", { name: "Motion" }).click();
  const studio = page.locator('[data-desk="studio"]');
  await expect(studio).toBeVisible();
  return studio;
}

test("Design locks an element of the approved design, and the client approves the version with it locked", async ({ page }) => {
  await signIn(page, CEO);
  const ws = await openWorkshop(page, "ceo");
  await ws.getByRole("tab", { name: "Layers" }).click();
  await ws.getByLabel("Layers, outermost first").getByRole("button", { name: LOCKED, exact: true }).click();
  await ws.getByRole("button", { name: "Lock (protects it from edits)" }).click();
  await expect(ws.locator(".ws-save")).toHaveText("Saved");
  await ws.getByRole("button", { name: "Send for decision" }).click();
  await page.getByRole("dialog", { name: "Send for a decision" }).getByRole("button", { name: "Send for decision" }).click();
  await expect(ws.locator(".ws-banner")).toContainText("Sent for a decision");

  await page.context().clearCookies();
  await signIn(page, OWNER);
  const client = await openWorkshop(page, "client");
  const decide = client.getByRole("region", { name: "Your decision" });
  const before = mailCount();
  await decide.getByRole("button", { name: "Approve this design" }).click();
  const form = decide.getByRole("form", { name: "Confirm it's you" });
  const toast = client.locator(".ws-toast");
  await expect(form.or(toast)).toBeVisible();
  if (await form.isVisible()) {
    const mail = await mailTo(OWNER, "step-up", before);
    await form.getByPlaceholder("Six-digit code").fill(mail.meta!.code!);
    await form.getByRole("button", { name: "Confirm", exact: true }).click();
  }
  await expect(toast).toContainText("Approved. This is now the design the work follows.");
});

test("the Motion bench opens a piece from v4's first cut over the approved design, and plays v4's preview", async ({ page }) => {
  // Content's finished copy deck, standing in for its run: Media plays the approved words, never writes them.
  seedCopyDeck(project.id);
  await signIn(page, CEO);
  const studio = await openStudio(page);
  await studio.getByRole("button", { name: "Start a piece" }).click();
  await expect(studio.locator(".ws-project")).toHaveText("piece-1");
  await expect(studio.getByRole("button", { name: /^Beat Open, 0 s to 3 s$/ })).toBeVisible();
  await expect(studio.getByRole("button", { name: /^Beat Next, 3 s to 6 s$/ })).toBeVisible();
  // The preview is v4's own page; it says when it has laid itself out, and is moved by the playhead.
  await expect(studio.locator(".st-screen[data-ready]")).toBeVisible();
  await studio.getByLabel("Playhead").fill("1500");
  await expect(studio.locator(".st-time")).toHaveText("1.50 / 6.00 s");
  await studio.getByRole("tab", { name: "Checks" }).click();
  await expect(studio.getByText("Nothing stops a render against the approved design.")).toBeVisible();
  await shot(page, "The Media studio: a piece over the approved design, with v4's preview, the beats and the elements that move");
});

test("moving the locked element is refused by v4, and the change goes to Design as a change request on it", async ({ page }) => {
  await signIn(page, CEO);
  const studio = await openStudio(page);
  const elements = studio.getByRole("complementary", { name: "Elements" });
  const locked = elements.getByRole("button", { name: new RegExp(`^${LOCKED}`) });
  await expect(locked.getByLabel("locked")).toBeVisible();
  await locked.click();
  await studio.getByLabel("Motion").selectOption({ label: "Rise" });
  const refused = studio.getByRole("region", { name: "Refused by v4" });
  await expect(refused).toContainText("Design locked this element");
  // Nothing was stored: the element still does not move.
  await expect(locked.locator(".ws-chip")).toHaveCount(0);
  await shot(page, "v4 refuses motion on an element Design locked; the studio offers to ask Design");
  await refused.getByRole("button", { name: "Ask Design" }).click();
  await expect(refused).toContainText("Sent to Design as a change request on this element");

  // It is in the Workshop's own feedback, on that element, open for Design to answer.
  await page.getByRole("group", { name: "Bench" }).getByRole("button", { name: "Design" }).click();
  const ws = page.locator('[data-desk="workshop"]');
  await expect(ws.locator(".ws-banner")).toContainText("1 change request is open");
  await ws.getByRole("tab", { name: "Feedback" }).click();
  await expect(ws.getByRole("article").filter({ hasText: "From the Media studio (piece-1)" })).toBeVisible();
});

test("a free edit renders: a shorter opening is saved, v4 renders the file, and Design's check passes it", async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page, CEO);
  const studio = await openStudio(page);
  await studio.getByRole("button", { name: /^Beat Open/ }).click();
  await studio.getByLabel(/^Length/).fill("2.5");
  await expect(studio.locator(".ws-save")).toHaveText("Saved");
  await expect(studio.getByRole("button", { name: /^Beat Open, 0 s to 2.5 s$/ })).toBeVisible();
  await expect(studio.getByRole("button", { name: /^Beat Next, 2.5 s to 5.5 s$/ })).toBeVisible();

  await studio.getByRole("button", { name: "Render" }).click();
  await expect(studio.locator(".ws-toast")).toContainText("Asked for.");
  const render = studio.getByRole("article", { name: "Render 1" });
  await expect(render).toContainText("Waiting for the worker");

  // The worker's sweep: v4 renders it in Chromium and FFmpeg, keeps the file, and Design checks it.
  const done = runStudioRenders();
  expect(done.map((r) => r.status), JSON.stringify(done)).toEqual(["RENDERED"]);
  await expect(render).toContainText("Rendered", { timeout: 15_000 });
  const ladder = render.getByRole("list", { name: "Checks" });
  await expect(ladder.locator(":scope > li")).toHaveCount(4);
  await expect(ladder.locator('li[data-gate="PASSED"]').filter({ hasText: "Design's check" })).toBeVisible();
  await expect(ladder.locator('li[data-gate="PASSED"]').filter({ hasText: "Words and slots" })).toBeVisible();
  await expect(render.getByRole("img").first()).toBeVisible();
  await expect(render.getByRole("button", { name: "Download the newest file" })).toBeVisible();
  await shot(page, "The free edit rendered by v4, with the check rail and the frame sheet; Design's check passed the file");
});
