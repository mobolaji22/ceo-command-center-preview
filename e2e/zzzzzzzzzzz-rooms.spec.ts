import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";

/**
 * The studio's bench has a station for each of the seven rooms the agency works in, as v4 serves them (v4 ADR-0092, ADR-0099): the same
 * rooms in the same order, each station's pin is v4's count, a quiet room says so, and entering a room with work in it shows the work.
 * The test holds no list of its own; it compares the bench with what the API says.
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

test("the bench has the seven rooms in v4's order, each pin is v4's, and entering a room with work in it shows the work", async ({ page }) => {
  await signIn(page, CEO);
  const studio = (await (await page.request.get("/api/v4/v1/studio")).json()) as { stations: { room: string; needsYou: number; live: number; held: number }[] };
  const rooms = ((await (await page.request.get("/api/v4/v1/domains")).json()) as { domains: { room: { code: string; name: string } }[] }).domains;
  const nameOf = new Map(rooms.map((d) => [d.room.code, d.room.name]));
  expect(studio.stations).toHaveLength(7);

  const stations = page.getByRole("list", { name: "The bench, one station for each craft" }).locator(".station");
  await expect(stations.locator(".station-name")).toHaveText(studio.stations.map((s) => nameOf.get(s.room)!));
  // Each pin says what v4 counted, in the order that matters: what needs you, what is held, what is at work; or that it is quiet.
  const words = (s: { needsYou: number; live: number; held: number }) => {
    const w = [s.needsYou && `${s.needsYou} for you`, s.held && `${s.held} held`, s.live && `${s.live} at work`].filter(Boolean);
    return w.length ? w.join("") : "quiet";
  };
  await expect(stations.locator(".station-pin")).toHaveText(studio.stations.map(words));
  const busy = studio.stations.find((s) => s.live + s.held + s.needsYou > 0);
  const quiet = studio.stations.find((s) => s.live + s.held + s.needsYou === 0);
  expect(busy, "some room has work in it").toBeTruthy();
  expect(quiet, "seven rooms are never all in use").toBeTruthy();
  await shot(page, "The studio: the bench, a station for each room with its pin");

  await stations.filter({ hasText: nameOf.get(busy!.room)! }).getByRole("button").click();
  await expect(page.getByLabel("On the desks")).toContainText(/\d+ in motion · \d+ waiting · \d+ done/);
  // The projects are pinned to the wall: press the wall, open its desk, and they are there.
  await page.getByRole("button", { name: "Wall", exact: true }).click();
  await expect(page.locator(".pin-card").first()).toBeVisible();
  await shot(page, "The wall desk: the projects pinned to the room");
  await page.getByRole("button", { name: "BACK TO ROOM" }).click();

  await page.getByRole("button", { name: "Back to the studio" }).click();
  await stations.filter({ hasText: nameOf.get(quiet!.room)! }).getByRole("button").click();
  // A quiet pin means nothing is at work, held or waiting on you there; the room still opens on what it holds.
  await expect(page.getByLabel("On the desks")).toContainText(/^0 in motion/);
});
