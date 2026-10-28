import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";

/**
 * The corridor's rooms are the domains the agency works in, as v4 serves them from its pack registry (CC-6, ADR-0017), not
 * whatever words projects carry: always the same rooms in the same order, a quiet room is quiet, and a room with work in it
 * shows that work. The test holds no list of its own; it compares the corridor with what the API says.
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

test("the corridor has the thirteen domains in five wings, in order, and entering one with work in it shows the work", async ({ page }) => {
  await signIn(page, CEO);
  await page.getByRole("button", { name: "Door", exact: true }).click();

  const served = await page.request.get("/api/v4/v1/domains");
  expect(served.status()).toBe(200);
  const domains = ((await served.json()) as { domains: { name: string; department: { name: string } }[] }).domains;
  const names = domains.map((d) => d.name);
  expect(names).toHaveLength(13);
  expect(new Set(domains.map((d) => d.department.name)).size).toBe(5);
  const doors = page.locator(".door-card");
  await expect(doors.locator(".door-name")).toHaveText(names);
  // Each door says which wing (department) it is in, as the API says (v4 ADR-0018).
  await expect(doors.locator(".door-wing")).toHaveText(domains.map((d) => d.department.name));
  const quiet = doors.filter({ hasText: "QUIET" });
  const busy = doors.filter({ hasText: "ACTIVE" });
  expect(await busy.count()).toBeGreaterThan(0);
  expect(await quiet.count()).toBeGreaterThan(0); // thirteen rooms are never all in use

  const name = (await busy.first().locator(".door-name").innerText()).trim();
  await busy.first().click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByLabel("On the desks")).toContainText(/\d+ in motion · \d+ waiting · \d+ done/);
  await shot(page, "A department room: a photograph with its wall, calendar and desk to press, and what is in motion, waiting and done");
  // The projects are pinned to the wall: press the wall, open its desk, and they are there.
  await page.getByRole("button", { name: "Wall", exact: true }).click();
  await expect(page.locator(".pin-card").first()).toBeVisible();
  await shot(page, "The wall desk: the projects pinned to the department");
  await page.getByRole("button", { name: "BACK TO ROOM" }).click();

  await page.getByRole("button", { name: "ALL ROOMS" }).click();
  const quietName = (await quiet.first().locator(".door-name").innerText()).trim();
  await quiet.first().click();
  await expect(page.getByRole("heading", { name: quietName })).toBeVisible();
  await expect(page.getByText("No projects pinned on the walls.")).toBeVisible();
});
