import { expect, test, type Locator, type Page } from "@playwright/test";
import { allowCeoToDecideFor, forgetSignInRequests, priceTheAgency } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";
import { openClientDesk } from "./client-room";
import { answerEveryQuestion } from "./answers";

/**
 * Plans (P3.6): the plan for a request is a document a person can read and decide on. The client's owner asks for a change
 * and gets a new version with what changed, approves it, sees what that lets the agency do without asking, and takes it back.
 * The CEO can decide for the client only once the client's owner has said so, and the client sees that it happened.
 * Runs after sign-in.spec.ts (which creates Orbit and its owner) and zz-requests.spec.ts.
 */
const CEO = "ceo@agency.example";
const OWNER = "owner@orbit.example";
const ASK = "Redesign our online checkout for our customers and write blog posts so that more orders complete, by the end of March, with a budget of 5000";

/** Approving a plan commits the client's money, so the server asks for the code it just emailed. Enter it and the approval goes through. */
async function enterStepUpCode(plan: Locator, email: string, emailsBefore: number) {
  const form = plan.getByRole("form", { name: "Confirm it's you" });
  await expect(form).toBeVisible();
  await shot(plan.page(), "Approving a plan asks for a fresh emailed code before anything is approved");
  await expect(plan.getByText("Approved. The work can begin.")).toHaveCount(0); // nothing is approved until the code is right
  const mail = await mailTo(email, "step-up", emailsBefore);
  await form.getByPlaceholder("Six-digit code").fill(mail.meta!.code!);
  await form.getByRole("button", { name: "Confirm", exact: true }).click();
}

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

async function sendRequest(page: Page, text: string) {
  await openClientDesk(page, "Board", /Your requests/);
  const composer = page.getByLabel("New request");
  await composer.getByLabel("WHAT WOULD YOU LIKE DONE?").fill(text);
  await composer.getByRole("button", { name: "Send request" }).click();
  await expect(composer.getByRole("status")).toContainText("Received.");
  // v4 may ask before it plans; the questions are not what these tests are about.
  const card = page.locator(".intent-card", { hasText: text.slice(0, 30) }).first();
  await answerEveryQuestion(card);
  await expect(card.locator('[data-stage="PLAN_READY"]')).toBeVisible();
}

/** The high end of a price as the client reads it ("$1,840 to $2,208"). */
const money = async (text: string | null) => Number(/\$([\d,.]+) to \$([\d,.]+)/.exec(text ?? "")![2].replace(/,/g, ""));

test.describe.configure({ mode: "serial" });
evidence(test);
test.beforeEach(() => forgetSignInRequests());

test("a client reads the plan, asks for a change, sees what changed, approves it, and takes the permission back", async ({ page }) => {
  priceTheAgency(CEO);
  await signIn(page, OWNER);
  await sendRequest(page, ASK);

  const card = page.locator(".intent-card", { hasText: "Redesign our online checkout" }).first();
  await expect(card.locator('[data-stage="PLAN_READY"]')).toBeVisible();
  const plan = card.getByLabel("Plan");
  await expect(plan.getByText("Version 1")).toBeVisible();
  await expect(plan.locator(".resolved-row .pill").first()).toHaveText("AWAITING A DECISION");
  // A client reads the plan in the order they need it (P6.20): the price and the decision first, then what they get. The
  // internal work (tasks, domains, effort levels) is not theirs to read.
  const price = plan.getByLabel("Price");
  await expect(price).toContainText(/\$[\d,]+ to \$[\d,]+/);
  await expect(price).toContainText("Agency fee 15%");
  for (const heading of ["What you get", "What we assumed"]) await expect(plan.getByRole("heading", { name: heading })).toBeVisible();
  for (const heading of ["The work", "What it may cost"]) await expect(plan.getByRole("heading", { name: heading })).toHaveCount(0);
  await shot(page, "The plan as a client reads it: the price and the decision first");
  const before = await money(await price.locator(".cv-total").textContent());

  // Ask for a change: the answer is the next version, with what changed.
  await plan.getByRole("button", { name: "Ask for a change" }).click();
  await plan.getByLabel("WHAT WOULD YOU LIKE CHANGED?").fill("Make it cheaper");
  await plan.getByRole("button", { name: "Send" }).click();
  await expect(plan.getByRole("status")).toContainText("Version 2 is ready for you");
  await expect(plan.getByRole("tab", { name: "v2" })).toHaveAttribute("aria-selected", "true");
  expect(await money(await plan.getByLabel("Price").locator(".cv-total").textContent())).toBeLessThan(before);
  await plan.getByRole("button", { name: "What changed since version 1" }).click();
  await expect(plan.getByLabel("What changed").getByText(/^Price:/)).toBeVisible();
  await expect(plan.getByLabel("What changed").getByText(/^Budget:|effort/)).toHaveCount(0);
  await plan.getByRole("tab", { name: "v1" }).click();
  await expect(plan.locator(".resolved-row .pill").first()).toHaveText("REPLACED");
  await expect(plan.getByRole("button", { name: "Approve" })).toHaveCount(0); // an old version cannot be decided
  await plan.getByRole("tab", { name: "v2" }).click();

  // Approve, after being told what it means.
  await plan.getByRole("button", { name: "Approve" }).click();
  await expect(plan.getByText(/without asking again, within these limits/)).toBeVisible();
  await expect(plan.getByText("we will ask you for a six-digit code")).toBeVisible();
  const asked = mailCount();
  await plan.getByRole("button", { name: "Confirm approval" }).click();
  await enterStepUpCode(plan, OWNER, asked);
  await expect(plan.getByRole("status").first()).toContainText("Approved. The work can begin.");
  await expect(plan.locator(".resolved-row .pill").first()).toHaveText("APPROVED");
  const history = plan.locator(".plan-history");
  await expect(history).toContainText("Version 1: Asked for a change");
  await expect(history).toContainText("Version 2: Approved");
  await expect(history).toContainText("You");

  // What the approval lets the agency do, and the way to take it back.
  const delegation = plan.getByLabel("What we may do without asking again");
  await expect(delegation).toContainText("In force");
  await expect(delegation).toContainText("come to you first");
  await delegation.getByRole("button", { name: "Take this back" }).click();
  await delegation.getByLabel("Why (optional)").fill("We want to review each step");
  await delegation.getByRole("button", { name: "Confirm: take it back" }).click();
  await expect(delegation).toContainText("Taken back");
  await expect(delegation).toContainText("Every step now asks first");
  await expect(delegation.getByText("Nothing is delegated now")).toBeVisible();
});

test("the CEO sees the plan but cannot decide it for the client until the client's owner allows it; then the client sees who decided", async ({ browser, page }) => {
  await signIn(page, OWNER);
  await sendRequest(page, "Redesign our pricing page for our customers and write blog posts so that more visitors start a trial, by the end of April, with a budget of 4000");
  const clientCard = page.locator(".intent-card", { hasText: "Redesign our pricing page" }).first();
  await expect(clientCard.getByLabel("Plan").getByText("Version 1")).toBeVisible();

  const ceoPage = await (await browser.newContext()).newPage();
  const openAsCeo = async () => {
    await ceoPage.goto("/");
    await ceoPage.getByRole("button", { name: "Preview Directive" }).click();
    await ceoPage.getByRole("button", { name: "Compose directive" }).click();
    const all = ceoPage.getByRole("button", { name: /^SHOW ALL/ });
    if (await all.count()) await all.click();
    return ceoPage.locator(".intent-card", { hasText: "Redesign our pricing page" }).first().getByLabel("Plan");
  };
  await signIn(ceoPage, CEO);
  let plan = await openAsCeo();
  await expect(plan.getByText("Version 1")).toBeVisible();
  await expect(plan.getByText(/You can make it only if their owner gives you permission/)).toBeVisible();
  await expect(plan.getByRole("button", { name: /^Approve/ })).toHaveCount(0);

  // The client's owner switches it on; the CEO may now decide, after being told whose decision it is.
  allowCeoToDecideFor("Orbit", CEO, OWNER);
  plan = await openAsCeo();
  await expect(plan.getByText(/Their owner has given you permission to decide it/)).toBeVisible();
  await plan.getByRole("button", { name: "Approve for the client" }).click();
  await expect(plan.getByText(/You are deciding for the client. They will see that you did/)).toBeVisible();
  const askedCeo = mailCount();
  await plan.getByRole("button", { name: "Confirm approval" }).click();
  await enterStepUpCode(plan, CEO, askedCeo);
  await expect(plan.getByRole("status").first()).toContainText("Approved");
  await expect(plan.locator(".plan-history")).toContainText("You, on the client's behalf");

  // And the client sees it, in their own words.
  await page.reload();
  await openClientDesk(page, "Board", /Your requests/);
  const again = page.locator(".intent-card", { hasText: "Redesign our pricing page" }).first().getByLabel("Plan");
  await expect(again.locator(".plan-history")).toContainText("The agency's CEO, on your behalf");
  await expect(again.locator(".resolved-row .pill").first()).toHaveText("APPROVED");
  await ceoPage.context().close();
});
