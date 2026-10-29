import { expect, test, type Locator, type Page } from "@playwright/test";
import { driveDesignRun, forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";
import { newClientRequest, openClientDesk } from "./client-room";
import { answerEveryQuestion } from "./answers";

/**
 * Choosing a design direction where it is drawn (dev-playbook-v4 ADR-0049). A client asks for a design direction and approves a
 * plan narrowed to it; the run draws three territories into the project's design document and asks the client's owner to choose.
 * The question's link opens their questions, the three directions are there as wireframes, and choosing one answers it. The CEO's
 * Workshop then shows the same document with the choice in it. The model is a script (e2e/design-run.mjs); the rest is v4's.
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

const story = { link: "", projectName: "" };

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
});

test("the question's link opens the client's questions; the three directions are drawn there, and choosing one answers it", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto(story.link);
  await page.waitForURL((u) => u.pathname === "/client" && u.searchParams.get("desk") === "requests");
  const question = page.locator("article.question", { hasText: "Choose the design direction" }).first();
  await expect(question).toBeVisible();
  await question.getByRole("button", { name: "See the three directions" }).click();

  const directions = question.getByLabel("Design directions");
  await expect(directions.getByText("Choose a direction")).toBeVisible();
  const each = directions.locator("article.direction");
  await expect(each).toHaveCount(3);
  for (const name of ["Roastery Notice", "Batch Ticket", "Roast Calendar"]) {
    const t = directions.getByRole("article", { name });
    await expect(t.locator("figure.wireframe")).toHaveCount(2);
    await expect(t.getByText("Not rendered")).toBeVisible();
    // The words on a frame are slots for the copy still to be written, never the copy itself.
    await expect(t.locator(".wf-slot").first()).toBeVisible();
  }
  await shot(page, "The three directions the run drew, as wireframes, where the client's owner answers the question");

  const chosen = directions.getByRole("article", { name: "Batch Ticket" });
  await chosen.getByRole("button", { name: "Choose with changes" }).click();
  await chosen.getByLabel("What should change?").fill("Warmer colours on the ticket");
  await chosen.getByRole("button", { name: "Confirm: choose Batch Ticket with these changes" }).click();
  await expect(directions.getByRole("status")).toContainText("Chosen: Batch Ticket");
  await shot(page, "Choosing a direction answers the question");
});

test("the CEO's Workshop shows the project's design document, with the client's choice in it", async ({ page }) => {
  await signIn(page, CEO);
  await page.goto("/?room=DESIGN&spot=workshop");
  const picker = page.getByLabel("Design project");
  if (await picker.count()) await picker.selectOption({ label: story.projectName });
  const directions = page.getByLabel("Design directions");
  await expect(directions.getByText("The directions explored")).toBeVisible();
  await expect(directions.getByRole("article", { name: "Batch Ticket" }).locator(".pill")).toHaveText("CHOSEN");
  await expect(directions.getByRole("article", { name: "Roastery Notice" }).locator(".pill")).toHaveText("SET ASIDE");
  await expect(directions.getByRole("button", { name: /^Choose / })).toHaveCount(0);
  await shot(page, "The CEO's Workshop reads v4's design document: the chosen direction and the ones set aside");
});
