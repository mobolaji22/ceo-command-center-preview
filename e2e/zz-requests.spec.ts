import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";

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
test.beforeEach(() => forgetSignInRequests());

test("a client sends a request with a file and a link, answers the questions, settles the materials, and the project opens", async ({ page }) => {
  await signIn(page, OWNER);
  await expect(page.getByRole("heading", { name: /Your projects/ })).toBeVisible();

  const composer = page.getByLabel("New request");
  await composer.getByLabel("WHAT WOULD YOU LIKE DONE?").fill("We want a better website for our customers");
  await composer.locator('label.attach input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Our customers like simple pages.") });
  await composer.getByLabel("OR PASTE A LINK").fill("https://example.com/current-site");
  await composer.getByRole("button", { name: "Add link" }).click();
  // The link goes to the library, the file stays with this project.
  await composer.getByLabel("Where it goes").nth(1).selectOption("ORGANIZATION");
  await composer.getByRole("button", { name: "Send request" }).click();
  await expect(composer.getByRole("status")).toContainText("Received. A few questions");

  const card = page.locator(".intent-card", { hasText: "We want a better website" });
  await expect(card.locator(".pill")).toHaveText("NEEDS ANSWERS");
  await expect(card.locator(".question")).toHaveCount(2);

  // One ask: the questions and the materials list are together.
  await expect(card.getByText("WHAT WE NEED FROM YOU")).toBeVisible();
  await expect(card.locator('.material[aria-label="Brand guidelines"]')).toBeVisible();

  await card.getByRole("button", { name: /More sales or sign-ups/ }).click();
  await card.getByRole("button", { name: /Within the quarter/ }).click();
  await expect(card.locator(".pill")).toHaveText("PLANNED");
  await expect(card.locator(".question")).toHaveCount(0);

  // Settle the materials list, each in a different way.
  await card.getByLabel("Upload for Brand guidelines").setInputFiles({ name: "brand.txt", mimeType: "text/plain", buffer: Buffer.from("Warm and direct.") });
  await expect(page.getByRole("status").filter({ hasText: "Thanks, we have brand guidelines." })).toBeVisible();
  await card.locator('.material[aria-label="Logo files"]').getByRole("button", { name: "I don't have this" }).click();
  // The link sent with the request already answered "the page to redesign", so it is not asked again.
  await expect(card.locator('.material[aria-label="Address of the page or site to redesign"]')).toHaveCount(0);
  await expect(card.locator('.material[aria-label="Access to where this will live"]')).toBeVisible();
  await card.locator('.material[aria-label="Access to where this will live"]').getByRole("button", { name: "I don't have this" }).click();
  await expect(card.getByText("Nothing more is needed from you right now.")).toBeVisible();

  // The project opened when the request was understood, and the link we sent to the library is there.
  await expect(page.locator(".resolved-row", { hasText: "We want a better website" }).first()).toBeVisible();
  await expect(page.locator(".library .resolved-row", { hasText: "example.com/current-site" })).toBeVisible();

  // The assumption we made instead of asking is shown, not hidden.
  await expect(card.getByText("We are going with:")).toBeVisible();
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
  const composer = page.getByLabel("New request");
  await composer.getByLabel("CLIENT").selectOption({ label: "Orbit" });
  await composer.getByLabel("WHAT WOULD YOU LIKE DONE?").fill("Refresh the brand");
  await composer.getByRole("button", { name: "Send request" }).click();
  await expect(composer.getByRole("status")).toContainText("Received.");

  const card = page.locator(".intent-card", { hasText: "Refresh the brand" });
  await expect(card.locator(".pill")).toHaveText("NEEDS ANSWERS");
  await expect(card.getByText("from the agency")).toBeVisible();
  await card.getByRole("button", { name: /More sales or sign-ups/ }).click();
  await card.getByRole("button", { name: /As soon as possible/ }).click();
  await expect(card.locator(".pill")).toHaveText("PLANNED");
});
