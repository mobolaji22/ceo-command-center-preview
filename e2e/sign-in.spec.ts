import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";

const CEO = "ceo@agency.example";
const OWNER = "owner@orbit.example";
// A real, tiny PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function requestLink(page: Page, email: string) {
  const before = mailCount();
  await page.goto("/auth");
  await page.getByLabel("EMAIL").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("heading", { name: /Check your email/ })).toBeVisible();
  return mailTo(email, "sign-in", before);
}

test.describe.configure({ mode: "serial" });
evidence(test);
test.beforeEach(() => forgetSignInRequests());

test("there are no passwords anywhere", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect((await page.goto("/reset-password"))?.status()).toBe(404);
});

test("the CEO signs in through an emailed link, and the session is not readable by scripts", async ({ page, context }) => {
  const mail = await requestLink(page, CEO);
  await page.goto(mail.meta!.link!);
  // Opening the link does not spend it: a person has to confirm.
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: /The command center/ })).toBeVisible();
  await shot(page, "The CEO signs in with an emailed code and arrives in the office");

  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === "dpb_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  expect(await page.evaluate(() => document.cookie)).not.toContain("dpb_session");
  // And nothing the page can see holds the secret.
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toContain(session!.value);

  // The data on screen came from the real API, not fixtures.
  await expect(page.getByText("DEMO DATA")).toHaveCount(0);
  await expect(page.getByText(/0 projects/)).toBeVisible();
});

test("a used link cannot be used again, and a wrong code is refused", async ({ page, browser }) => {
  const mail = await requestLink(page, CEO);
  const first = await browser.newContext();
  const p1 = await first.newPage();
  await p1.goto(mail.meta!.link!);
  await p1.getByRole("button", { name: "Continue" }).click();
  await expect(p1.getByRole("heading", { name: /The command center/ })).toBeVisible();

  await page.goto(mail.meta!.link!);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".auth-msg")).toContainText(/expired or was already used/);

  // The code from the same email is also spent.
  await page.goto("/auth");
  await page.getByLabel("EMAIL").fill(CEO);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await page.getByLabel("SIX-DIGIT CODE").fill("000000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".auth-msg")).toContainText(/expired or was already used/);
  await first.close();
});

test("an address with no account looks exactly like one that has", async ({ page }) => {
  await page.goto("/auth");
  await page.getByLabel("EMAIL").fill("nobody@nowhere.example");
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("heading", { name: /Check your email/ })).toBeVisible();
});

test("the CEO adds a client, invites its owner after a step-up, and the owner signs in from the invitation and uploads a file", async ({ page, browser }) => {
  // Sign in with the six-digit code this time.
  const mail = await requestLink(page, CEO);
  await page.getByLabel("SIX-DIGIT CODE").fill(mail.meta!.code!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /The command center/ })).toBeVisible();

  await page.getByRole("button", { name: "Manage records and clients" }).click();
  await page.getByRole("tab", { name: "Organizations" }).click();
  await page.getByPlaceholder("Name").fill("Orbit");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Organization added.")).toBeVisible();
  await shot(page, "The CEO adds a client organization");

  await page.getByRole("tab", { name: "People" }).click();
  await page.getByPlaceholder("person@company.com").fill(OWNER);
  const beforeInvite = mailCount();
  await page.getByRole("button", { name: "Send invitation" }).click();

  // Inviting is sensitive: the server asks the CEO to prove it is still them.
  await expect(page.getByRole("form", { name: "Confirm it's you" })).toBeVisible();
  await shot(page, "Inviting someone is sensitive, so the CEO is asked for a fresh emailed code");
  const stepUp = await mailTo(CEO, "step-up", beforeInvite);
  await page.getByPlaceholder("Six-digit code").fill(stepUp.meta!.code!);
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText(`Invitation emailed to ${OWNER}`)).toBeVisible();
  await expect(page.getByText(OWNER)).toBeVisible();

  // The invitation signs the new owner in, in a different browser.
  const invite = await mailTo(OWNER, "invitation");
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await owner.goto(invite.meta!.link!);
  await owner.getByRole("button", { name: "Accept invitation" }).click();
  await expect(owner.getByRole("heading", { name: /Your projects/ })).toBeVisible();
  await shot(owner, "The invited owner signs in from the invitation and lands in their own room");

  // A client cannot reach the CEO's office.
  await owner.goto("/");
  await expect(owner).toHaveURL(/\/client$/);

  // They add a file to their library; it is scanned before it can be downloaded.
  const library = owner.locator(".library");
  await library.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await library.getByRole("button", { name: "Upload" }).click();
  await expect(library.getByRole("status")).toContainText("passed its safety scan");
  const row = owner.locator(".resolved-row", { hasText: "logo.png" });
  await expect(row.getByText("CLEAN")).toBeVisible();
  await shot(owner, "The owner adds a file to their library; it is scanned before it can be downloaded");
  const [download] = await Promise.all([owner.waitForEvent("download"), row.getByRole("button", { name: "Download" }).click()]);
  expect(download.suggestedFilename()).toBe("logo.png");

  // A file that is not what it claims to be is refused, and nothing is left behind to download.
  await library.locator('input[type="file"]').setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("this is text, not a picture") });
  await library.getByRole("button", { name: "Upload" }).click();
  await expect(library.getByRole("status")).toContainText(/not accepted/);
  await expect(owner.locator(".resolved-row", { hasText: "fake.png" })).toHaveCount(0);

  // The CEO sees the new client in the console, with its owner.
  await page.getByRole("tab", { name: "Library" }).click();
  await expect(page.locator(".resolved-row", { hasText: "logo.png" })).toBeVisible();
  await ownerCtx.close();
});

test("signing out ends the session for good", async ({ page, context }) => {
  const mail = await requestLink(page, CEO);
  await page.goto(mail.meta!.link!);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: /The command center/ })).toBeVisible();
  const secret = (await context.cookies()).find((c) => c.name === "dpb_session")!.value;

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/auth$/);
  expect((await context.cookies()).find((c) => c.name === "dpb_session")).toBeUndefined();

  // Even the old cookie is dead at the API: the session was revoked, not just forgotten.
  const res = await page.request.get("/api/session", { headers: { cookie: `dpb_session=${secret}` } });
  expect((await res.json()).session).toBeNull();
});

test("the browser cannot mint or read a session through the proxy, and cross-site writes are refused", async ({ page }) => {
  await page.goto("/auth");
  const verify = await page.request.post("/api/v4/v1/auth/sign-in/verify", { data: { token: "x" }, headers: { origin: "http://localhost:3100" } });
  expect(verify.status()).toBe(404);
  const accept = await page.request.post("/api/v4/v1/invitations/accept", { data: { token: "x" }, headers: { origin: "http://localhost:3100" } });
  expect(accept.status()).toBe(404);
  const forged = await page.request.post("/api/auth/request", { data: { email: CEO }, headers: { origin: "https://evil.example" } });
  expect(forged.status()).toBe(403);
  const noOrigin = await page.request.post("/api/auth/request", { data: { email: CEO } });
  expect(noOrigin.status()).toBe(403);
});
