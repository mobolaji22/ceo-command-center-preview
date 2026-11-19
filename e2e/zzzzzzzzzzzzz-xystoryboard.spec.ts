import { expect, test, type Locator, type Page } from "@playwright/test";
import { approvedDesignProject, forgetSignInRequests, runStudioRenders, seedCopyDeck } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";

/**
 * Storyboards in the Media studio (dev-playbook-v4 ADR-0085 Order step 3), on the design the Workshop journey approved and after the
 * studio journey. With Content's copy deck and its script group in place (a stand-in, e2e/copy-seed.mjs), the CEO opens a storyboard
 * of Media's own scenes, sends it to Design, and as Design asks for a change on a scene; the scene is changed on the Workshop's own
 * canvas, sent again and approved. A piece made from it plays the script over its beats, renders in v4's renderer and passes Design's
 * check. A scene changed after approval sends the storyboard back to a draft, and the piece cannot render until Design approves again.
 */
const CEO = "ceo@agency.example";

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

async function openBoards(page: Page): Promise<Locator> {
  await page.goto("/?room=DESIGN&spot=workshop");
  const picker = page.getByLabel("Design project");
  if (await picker.count()) await picker.selectOption({ label: project.name });
  await expect(page.locator('[data-desk="workshop"]')).toBeVisible();
  await page.getByRole("group", { name: "Bench" }).getByRole("button", { name: "Motion" }).click();
  await expect(page.locator('[data-desk="studio"]')).toBeVisible();
  await page.locator('[data-desk="studio"]').getByRole("button", { name: "Storyboards" }).click();
  const boards = page.locator('[data-desk="storyboard"]');
  await expect(boards).toBeVisible();
  return boards;
}

/** Moves the selected scene's title down a step on the canvas, with the keyboard, as a person nudges an element in the Workshop. */
async function nudgeTitle(boards: Locator) {
  const title = boards.getByRole("region", { name: "Scene canvas" }).getByRole("button", { name: "title, text", exact: true });
  await title.focus();
  await title.press("Enter");
  await title.press("Shift+ArrowDown");
  await expect(boards.locator(".ws-save")).toHaveText("Saved");
}

test("Media opens a storyboard of its own scenes; Design asks for a change on a scene, then approves it", async ({ page }) => {
  seedCopyDeck(project.id, { script: true });
  await signIn(page, CEO);
  const boards = await openBoards(page);
  await boards.getByRole("button", { name: "Open a storyboard" }).click();
  await expect(boards.locator(".ws-project")).toHaveText("storyboard-1");
  const strip = boards.getByRole("list", { name: "Storyboard strip" });
  await expect(strip.getByRole("button").first()).toBeVisible();
  const status = boards.locator(".ws-status .ws-chip").first();
  await expect(status).toHaveText("Draft");
  // The script is the copy deck's own, in the order Content wrote it.
  await expect(boards.locator(".sb-script li")).toHaveText(["You say what you need.", "The agency plans and builds it.", "And checks every step."]);
  await expect(boards.getByText("Every scene uses the brand's colours and type")).toBeVisible();
  await shot(page, "A storyboard of Media's own scenes: the strip in order, the scene on the Workshop's canvas, and the script");

  await boards.getByRole("button", { name: "Send to Design" }).click();
  await expect(status).toHaveText("With Design");
  await boards.getByRole("button", { name: "Ask for changes" }).click();
  await boards.getByLabel("What to change").fill("Give the title more room above it.");
  await boards.getByRole("button", { name: "Send the changes" }).click();
  await expect(status).toHaveText("Draft");
  await expect(boards.getByRole("region", { name: "Changes Design asked for" })).toContainText("Give the title more room above it.");

  await nudgeTitle(boards);
  await boards.getByRole("button", { name: "Send to Design" }).click();
  await expect(status).toHaveText("With Design");
  await boards.getByRole("button", { name: "Approve for Design" }).click();
  await expect(status).toHaveText("Approved, revision 1 approved");
  await shot(page, "Design approved the storyboard: revision 1, the one pieces render from");
});

test("a piece made from the approved storyboard plays the script over its beats, renders, and Design's check passes it", async ({ page }) => {
  test.setTimeout(420_000);
  await signIn(page, CEO);
  const boards = await openBoards(page);
  await boards.getByRole("button", { name: "Make a piece" }).click();
  const studio = page.locator('[data-desk="studio"]');
  await expect(studio.getByText("Storyboard revision 1")).toBeVisible();
  const script = studio.getByRole("group", { name: "Script" });
  await expect(script.getByRole("button")).toHaveCount(await studio.getByRole("group", { name: "Beats" }).getByRole("button").count());
  await expect(script.getByRole("button").first()).toContainText("You say what you need.");
  await expect(studio.locator(".st-screen[data-ready]")).toBeVisible();
  await expect(studio.getByLabel("Burn the script into the picture")).toBeChecked();
  await shot(page, "A piece over the approved storyboard: the scenes as beats, the script's lines under them, v4's preview with the captions");

  await studio.getByRole("button", { name: "Render" }).click();
  await expect(studio.locator(".ws-toast")).toContainText("Asked for.");
  const render = studio.getByRole("article", { name: "Render 1" });
  const done = runStudioRenders();
  expect(done.map((r) => r.status), JSON.stringify(done)).toEqual(["RENDERED"]);
  await expect(render).toContainText("Rendered", { timeout: 15_000 });
  const ladder = render.getByRole("list", { name: "Checks" });
  await expect(ladder.locator('li[data-gate="PASSED"]').filter({ hasText: "Design's check" })).toBeVisible();
  await expect(ladder.locator('li[data-gate="PASSED"]').filter({ hasText: "Words and slots" })).toBeVisible();
  await shot(page, "The storyboard's piece rendered by v4; Design's check held it to the approved scenes and passed it");
});

test("a scene changed after approval sends the storyboard back to a draft, and the piece waits for Design again", async ({ page }) => {
  await signIn(page, CEO);
  const boards = await openBoards(page);
  await nudgeTitle(boards);
  await expect(boards.locator(".ws-status .ws-chip").first()).toHaveText("Draft, revision 1 approved");
  await expect(boards.getByText(/^Changed since Design approved revision 1/)).toBeVisible();
  await expect(boards.getByRole("list", { name: "Storyboard strip" }).locator(".ws-chip", { hasText: "changed" })).toHaveCount(1);
  await shot(page, "A scene changed after approval: the storyboard is a draft again and the changed scene is marked for Design");

  await boards.getByRole("button", { name: "Pieces" }).click();
  const studio = page.locator('[data-desk="studio"]');
  await expect(studio.getByText(/Storyboard revision 1, waiting for Design/)).toBeVisible();
  await expect(studio.getByRole("button", { name: "Render" })).toBeDisabled();
  await studio.getByRole("tab", { name: /^Checks/ }).click();
  await expect(studio.getByText(/Design has not approved the storyboard/)).toBeVisible();
});
