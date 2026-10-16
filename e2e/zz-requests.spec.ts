import { newDirective } from "./directive";
import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";
import { newClientRequest, openClientDesk } from "./client-room";
import { answerEveryQuestion } from "./answers";

/**
 * Requests (P2.5): a client sends a request with attachments, is asked what matters, answers, settles the materials list,
 * and the project opens when it is understood. Runs after sign-in.spec.ts, which creates the Orbit client and its owner.
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

test("a client sends a request with a file and a link, answers the questions, settles the materials, and the project opens", async ({ page }) => {
  await signIn(page, OWNER);
  await expect(page.getByRole("heading", { name: "The client room." })).toBeVisible();
  await openClientDesk(page, "Board", /Your requests/);

  const composer = await newClientRequest(page);
  await composer.getByLabel("WHAT WOULD YOU LIKE DONE?").fill("We want a better website for our customers");
  await composer.locator('label.attach input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Our customers like simple pages.") });
  await composer.getByLabel("OR PASTE A LINK").fill("https://example.com/current-site");
  await composer.getByRole("button", { name: "Add link" }).click();
  // The link goes to the library, the file stays with this project.
  await composer.getByLabel("Where it goes").nth(1).selectOption("ORGANIZATION");
  await composer.getByRole("button", { name: "Send request" }).click();
  await expect(composer.getByRole("status")).toContainText("Received. A few questions");

  const card = page.locator(".intent-card", { hasText: "We want a better website" });
  // The client reads where it stands in one line, then one question at a time with its place in the round (P6.20).
  // What v4 asks today: the direction (the request could be read either way), whether a duty brings Compliance in, and the result to aim at.
  await expect(card.locator('[data-stage="QUESTIONS"]')).toBeVisible();
  await expect(card.locator(".cv-status")).toHaveText("3 questions for you.");
  await expect(card.getByText("Question 1 of 3")).toBeVisible();
  await expect(card.locator(".cv-question")).toHaveCount(1);
  await shot(page, "A client's request: where it stands, then one question at a time");

  // One ask: the question and the materials list are together.
  await expect(card.getByRole("heading", { name: "What we need from you" })).toBeVisible();
  await expect(card.locator('.material[aria-label="Brand guidelines"]')).toBeVisible();

  // Timing is asked once the rest is known.
  await answerEveryQuestion(card, [/^Keep the current direction/, /^No, none applies/, /^More sales or sign-ups/, /Within the quarter/]);
  await expect(card.locator('[data-stage="PLAN_READY"]')).toBeVisible();
  await expect(card.locator(".cv-question")).toHaveCount(0);

  // Settle the materials list, each in a different way.
  await card.getByLabel("Upload for Brand guidelines").setInputFiles({ name: "brand.txt", mimeType: "text/plain", buffer: Buffer.from("Warm and direct.") });
  await expect(page.getByRole("status").filter({ hasText: "Thanks, we have brand guidelines." })).toBeVisible();
  await card.locator('.material[aria-label="Logo files"]').getByRole("button", { name: "I don't have this" }).click();
  // The link sent with the request already answered "the page to redesign", so it is not asked again.
  await expect(card.locator('.material[aria-label="Address of the page or site to redesign"]')).toHaveCount(0);
  await expect(card.locator('.material[aria-label="Access to where this will live"]')).toBeVisible();
  await card.locator('.material[aria-label="Access to where this will live"]').getByRole("button", { name: "I don't have this" }).click();
  await expect(card.locator(".cv-block").getByRole("heading", { name: "What we need from you" })).toHaveCount(0);

  // What we assumed instead of asking is shown, not hidden: the plan states it.
  await expect(card.getByLabel("Plan").getByRole("heading", { name: "What we assumed" })).toBeVisible();

  // The project opened when the request was understood (on the table), and the link we sent to the library is there (on the shelf).
  await openClientDesk(page, "Table");
  await expect(page.locator("[data-desk]").getByText(/^1 project ·/)).toBeVisible();
  await openClientDesk(page, "Shelf", /Your library/);
  await expect(page.locator(".library .resolved-row", { hasText: "example.com/current-site" })).toBeVisible();
});

test("the old directive route is gone and says where to go", async ({ page }) => {
  await signIn(page, OWNER);
  const res = await page.request.post("/api/v4/v1/directives", { data: { rawInput: "x" }, headers: { origin: "http://localhost:3100" } });
  expect(res.status()).toBe(410);
  expect((await res.json()).use).toBe("POST /v1/intents");
});

test("the CEO sends a directive for a client, answers its questions, and sees what the client asked", async ({ page }) => {
  await signIn(page, CEO);
  await expect(page.getByRole("heading", { name: /The command center/ })).toBeVisible();

  // The client's request is in the console, with the project it opened.
  const overview = await (await page.request.get("/api/v4/v1/console/overview")).json();
  const theirs = overview.intents.find((i: { text: string }) => /better website/.test(i.text));
  expect(theirs.status).toBe("PLANNED");
  expect(theirs.project_id).toBeTruthy();

  await page.getByRole("button", { name: "Preview Directive" }).click();
  await page.getByRole("button", { name: "Compose directive" }).click();
  const composer = await newDirective(page);
  await composer.getByLabel("CLIENT").selectOption({ label: "Orbit" });
  await composer.getByLabel("WHAT WOULD YOU LIKE DONE?").fill("Refresh the brand");
  await composer.getByRole("button", { name: "Send request" }).click();
  await expect(composer.getByRole("status")).toContainText("Received.");

  const card = page.locator(".intent-card", { hasText: "Refresh the brand" });
  await expect(card.locator(".intent-head .pill")).toHaveText("NEEDS ANSWERS");
  await expect(card.getByText("from the agency")).toBeVisible();
  await answerEveryQuestion(card);
  await expect(card.locator(".intent-head .pill")).toHaveText("PLANNED");
});
