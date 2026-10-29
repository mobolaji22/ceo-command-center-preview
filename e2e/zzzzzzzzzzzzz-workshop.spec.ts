import { expect, test, type Locator, type Page } from "@playwright/test";
import { driveDesignRun, forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";
import { newClientRequest, openClientDesk } from "./client-room";
import { answerEveryQuestion } from "./answers";

/**
 * The design, from a direction chosen to a version approved twice (dev-playbook-v4 ADR-0049 and ADR-0051). A client asks for a design
 * direction and approves a plan narrowed to it; the run draws three territories into the project's design document and asks the
 * client's owner to choose. The question's link opens the client's Workshop, where the directions are drawn as v4 placed them, and
 * choosing one answers it. The CEO then edits the chosen direction and sends it for a decision; the client approves it, points at an
 * element and asks for a change; the CEO changes it, marks the request addressed and sends again; the client approves the second
 * version. The model is a script (e2e/design-run.mjs); every rule (who may see, edit, annotate, answer or approve) is v4's.
 * Runs after the journey (it adds a project), before the phone pass.
 */
const CEO = "ceo@agency.example";
const OWNER = "owner@orbit.example";
const ASK = "We need a design direction for our coffee roastery's new website: explore a few and let us choose one.";

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

async function enterStepUpCode(plan: Locator, email: string, emailsBefore: number) {
  const form = plan.getByRole("form", { name: "Confirm it's you" });
  await expect(form).toBeVisible();
  const mail = await mailTo(email, "step-up", emailsBefore);
  await form.getByPlaceholder("Six-digit code").fill(mail.meta!.code!);
  await form.getByRole("button", { name: "Confirm", exact: true }).click();
}

test.describe.configure({ mode: "serial" });
evidence(test);
test.beforeEach(() => forgetSignInRequests());

const story = { link: "", projectName: "", projectId: "" };

/** The Workshop for the design project: the CEO's in the Design room, the client's own desk. */
async function openWorkshop(page: Page, who: "ceo" | "client") {
  if (who === "ceo") {
    await page.goto("/?room=DESIGN&spot=workshop");
    const picker = page.getByLabel("Design project");
    if (await picker.count()) await picker.selectOption({ label: story.projectName });
  } else {
    await page.goto(`/client?desk=design&project=${encodeURIComponent(story.projectId)}`);
  }
  const ws = page.locator('[data-desk="workshop"]');
  await expect(ws).toBeVisible();
  return ws;
}

/** The client's owner decides: a decision needs a fresh proof of who is deciding, asked for when this session has none. */
async function approveDesign(ws: Locator) {
  const decide = ws.getByRole("region", { name: "Your decision" });
  const before = mailCount();
  await decide.getByRole("button", { name: "Approve this design" }).click();
  const form = decide.getByRole("form", { name: "Confirm it's you" });
  const toast = ws.locator(".ws-toast");
  await expect(form.or(toast)).toBeVisible();
  if (await form.isVisible()) await enterStepUpCode(decide, OWNER, before);
  await expect(toast).toContainText("Approved. This is now the design the work follows.");
}

const savedAndSettled = async (ws: Locator) => expect(ws.locator(".ws-save")).toHaveText("Saved");

test("a client asks for a design direction and approves a plan narrowed to it; the run asks them to choose in the Workshop", async ({ page }) => {
  await signIn(page, OWNER);
  await openClientDesk(page, "Board", /Your requests/);
  const composer = await newClientRequest(page);
  await composer.getByLabel("WHAT WOULD YOU LIKE DONE?").fill(ASK);
  await composer.getByRole("button", { name: "Send request" }).click();
  await expect(composer.getByRole("status")).toContainText("Received.");
  const card = page.locator(".intent-card", { hasText: ASK.slice(0, 30) }).first();
  await answerEveryQuestion(card);
  await expect(card.locator('[data-stage="PLAN_READY"]')).toBeVisible();

  // The direction first: the rest of the chain can wait until it is chosen.
  const plan = card.getByLabel("Plan");
  await plan.getByRole("button", { name: "Ask for a change" }).click();
  await plan.getByLabel("WHAT WOULD YOU LIKE CHANGED?").fill("Drop the research. Drop the brand. Drop the copy. Drop the engineering.");
  await plan.getByRole("button", { name: "Send" }).click();
  await expect(plan.getByRole("status")).toContainText("Version 2 is ready for you");
  await plan.getByRole("button", { name: "Approve" }).click();
  const asked = mailCount();
  await plan.getByRole("button", { name: "Confirm approval" }).click();
  await enterStepUpCode(plan, OWNER, asked);
  await expect(plan.getByRole("status").first()).toContainText("Approved. The work can begin.");

  const q = driveDesignRun(CEO);
  // Either wording v4 has used: the link in brackets after the question, or on a line of its own after the numbered directions.
  expect(q.summary).toMatch(/^Choose the design direction to take forward\b/);
  expect(q.summary).toMatch(/drawn in the Workshop/i);
  story.link = /(https?:\/\/[^\s)]+)/.exec(q.summary)![1]!;
  story.projectName = q.projectName;
  story.projectId = new URL(story.link).searchParams.get("project")!;
  expect(story.projectId).not.toBe("");
});

test("the question's link opens the client's Workshop; the three directions are drawn there, and choosing one answers it", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto(story.link);
  await page.waitForURL((u) => u.pathname === "/client" && u.searchParams.get("desk") === "design" && u.searchParams.get("project") === story.projectId);

  const directions = page.getByLabel("Design directions");
  await expect(directions.getByText("Choose a direction")).toBeVisible();
  await expect(directions.locator("article.direction")).toHaveCount(3);
  for (const name of ["Roastery Notice", "Batch Ticket", "Roast Calendar"]) {
    const t = directions.getByRole("article", { name });
    // Each key frame is drawn as v4 placed it, in the direction's own colours and type: a section that carries the idea.
    await expect(t.locator("figure.keyframe")).toHaveCount(2);
    await expect(t.locator("figure.keyframe .ws-node").first()).toBeVisible();
    await expect(t.getByText("Placeholders")).toBeVisible();
    // The words on a frame are slots for the copy still to be written, never the copy itself.
    await expect(t.locator(".ws-slot-words").first()).toBeVisible();
  }
  await shot(page, "The three directions the run drew, each key frame as v4 placed it, where the client's owner chooses");

  const chosen = directions.getByRole("article", { name: "Batch Ticket" });
  await chosen.getByRole("button", { name: "Choose with changes" }).click();
  await chosen.getByLabel("What should change?").fill("Warmer colours on the ticket");
  await chosen.getByRole("button", { name: "Confirm: choose Batch Ticket with these changes" }).click();
  await expect(directions.getByRole("status")).toContainText("Chosen: Batch Ticket");
  await shot(page, "Choosing a direction answers the question");
});

test("the CEO's Workshop opens the chosen direction to edit; an edit is saved into v4's draft, and the revision goes for a decision", async ({ page }) => {
  await signIn(page, CEO);
  const ws = await openWorkshop(page, "ceo");
  await expect(ws.getByRole("region", { name: "Canvas" }).getByText("Batch Ticket", { exact: true })).toBeVisible();
  await ws.getByRole("tab", { name: "Directions" }).click();
  await expect(ws.locator(".ws-terr.is-chosen")).toContainText("Batch Ticket");
  await expect(ws.locator(".ws-terr.is-chosen .ws-chip")).toHaveText("Chosen");
  await ws.getByRole("tab", { name: "Layers" }).click();

  // An edit is an operation on v4's document, saved into its one draft; the canvas is only a view of it.
  await ws.getByLabel("Layers, outermost first").getByRole("button", { name: "Headline", exact: true }).click();
  await ws.getByLabel("Role").fill("lead headline");
  await expect(ws.getByLabel("Layers, outermost first").getByRole("button", { name: "Lead headline", exact: true })).toBeVisible();
  await savedAndSettled(ws);
  await shot(page, "The CEO edits the chosen direction; the change is saved into v4's draft");

  await ws.getByRole("button", { name: "Send for decision" }).click();
  await page.getByRole("dialog", { name: "Send for a decision" }).getByRole("button", { name: "Send for decision" }).click();
  await expect(ws.locator(".ws-banner")).toContainText("Sent for a decision");
  // A revision waiting for a decision is frozen: nothing to edit until the client answers.
  await expect(ws.getByRole("button", { name: "Undo" })).toHaveCount(0);
});

test("the client sees the revision waiting on them and approves it, with a fresh proof of who they are", async ({ page }) => {
  await signIn(page, OWNER);
  const ws = await openWorkshop(page, "client");
  await expect(ws.locator(".ws-banner")).toContainText("This revision is waiting for your decision");
  await expect(ws.getByLabel("lead headline, text")).toBeVisible();
  await shot(page, "The client's owner sees the revision sent to them, and decides");
  await approveDesign(ws);
  await expect(ws.locator(".ws-banner")).toContainText("This is version 1, as approved");
});

test("the client points at an element and asks for a change; it is theirs to see, attributed and open", async ({ page }) => {
  await signIn(page, OWNER);
  const ws = await openWorkshop(page, "client");
  await expect(ws.locator(".ws-banner")).toContainText("This is version 1, as approved");
  // A client's tool is feedback: pointing at an element makes it what the feedback is about.
  await ws.getByLabel("lead headline, text").click();
  await expect(ws.getByLabel("About")).toHaveValue(/^NODE:/);
  await ws.getByLabel("Kind").selectOption({ label: "Change request" });
  await ws.getByLabel("What should change, or what you noticed").fill("Centre the headline over the ticket.");
  await ws.getByRole("button", { name: "Add change request" }).click();
  const card = ws.getByRole("article", { name: "Feedback 1" });
  await expect(card).toContainText("Centre the headline over the ticket.");
  await expect(card).toContainText("you");
  await expect(card.locator(".ws-state")).toHaveText("Open");
  await expect(ws.locator(".ws-pin")).toHaveCount(1);
  await shot(page, "The client's change request, pinned to the element it is about");
});

test("the CEO makes the change, marks the request addressed and sends the revision again", async ({ page }) => {
  await signIn(page, CEO);
  const ws = await openWorkshop(page, "ceo");
  await expect(ws.locator(".ws-banner")).toContainText("1 change request is open");
  await ws.getByLabel("Layers, outermost first").getByRole("button", { name: "Lead headline", exact: true }).click();
  await ws.getByRole("tab", { name: "Design" }).click();
  await ws.getByLabel("Alignment").selectOption("center");
  await savedAndSettled(ws);

  await ws.getByRole("tab", { name: "Feedback" }).click();
  const card = ws.getByRole("article", { name: "Feedback 1" });
  await expect(card).toContainText("another person");
  await card.getByRole("button", { name: "Mark addressed" }).click();
  await expect(card.locator(".ws-state")).toHaveText("Addressed in revision 2");
  await expect(ws.locator(".ws-banner")).toHaveCount(0);
  await shot(page, "The CEO answers the change request in the revision that makes it");

  await ws.getByRole("button", { name: "Send for decision" }).click();
  await page.getByRole("dialog", { name: "Send for a decision" }).getByRole("button", { name: "Send for decision" }).click();
  await expect(ws.locator(".ws-banner")).toContainText("Sent for a decision");
});

test("the client sees their request answered and approves the second version; both versions are kept", async ({ page }) => {
  await signIn(page, OWNER);
  const ws = await openWorkshop(page, "client");
  await expect(ws.locator(".ws-banner")).toContainText("This revision is waiting for your decision");
  await ws.getByRole("tab", { name: "Feedback" }).click();
  await expect(ws.getByRole("article", { name: "Feedback 1" }).locator(".ws-state")).toHaveText("Addressed in revision 2");
  await approveDesign(ws);
  await expect(ws.locator(".ws-banner")).toContainText("This is version 2, as approved");
  await ws.getByRole("tab", { name: "Versions" }).click();
  await expect(ws.getByText(/^Version \d$/)).toHaveText(["Version 2", "Version 1"]);
  await shot(page, "Version 2 approved; every approved version is kept");
});
