import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";

/**
 * The studio's rooms wait behind a tab on the office's left edge, one for each of the seven rooms the agency works in, as v4 serves
 * them (v4 ADR-0092, ADR-0099; the office home of 2026-11-27): the same rooms in the same order, each pin is v4's count, a quiet room
 * says so, and a room rises over the office with its own photograph, what is on its bench, and its menu of workbenches and steering.
 * The test holds no list of its own; it compares the rooms with what the API says.
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

type Station = { room: string; needsYou: number; live: number; held: number };
// Each pin says what v4 counted, in the order that matters: what needs you, what is held, what is at work; or that it is quiet.
const words = (s: Omit<Station, "room">) => {
  const w = [s.needsYou && `${s.needsYou} for you`, s.held && `${s.held} held`, s.live && `${s.live} at work`].filter(Boolean);
  return w.length ? w.join(" · ") : "quiet";
};

const openRooms = async (page: Page) => {
  await page.getByRole("button", { name: /The rooms$/ }).click();
  const drawer = page.getByRole("complementary", { name: "The rooms" });
  await expect(drawer).toHaveClass(/is-open/);
  return drawer;
};

test.describe.configure({ mode: "serial" });
evidence(test);
test.beforeEach(() => forgetSignInRequests());

test("the rooms are v4's seven in v4's order, each pin is v4's, and a room rises with its work, its workbenches and its steering", async ({ page }) => {
  await signIn(page, CEO);
  const studio = (await (await page.request.get("/api/v4/v1/studio")).json()) as { stations: Station[] };
  const rooms = ((await (await page.request.get("/api/v4/v1/domains")).json()) as { domains: { room: { code: string; name: string } }[] }).domains;
  const nameOf = new Map(rooms.map((d) => [d.room.code, d.room.name]));
  expect(studio.stations).toHaveLength(7);

  const drawer = await openRooms(page);
  const rows = drawer.locator(".rd-room");
  await expect(rows.locator(".rd-text b")).toHaveText(studio.stations.map((s) => nameOf.get(s.room)!));
  await expect(rows.locator(".rd-text em")).toHaveText(studio.stations.map(words));
  const busy = studio.stations.find((s) => s.live + s.held + s.needsYou > 0);
  const quiet = studio.stations.find((s) => s.live + s.held + s.needsYou === 0);
  expect(busy, "some room has work in it").toBeTruthy();
  expect(quiet, "seven rooms are never all in use").toBeTruthy();
  await shot(page, "The rooms, from the tab on the office's left edge: each with its photograph and v4's pin");

  // A room with work in it rises with its pin and what is on its bench.
  await rows.filter({ hasText: nameOf.get(busy!.room)! }).click();
  const room = page.getByRole("dialog", { name: nameOf.get(busy!.room)! });
  await expect(room).toHaveClass(/is-open/);
  const glance = (await (await page.request.get(`/api/v4/v1/rooms/${busy!.room}`)).json()) as { glance: { live: number; needsYou: unknown[]; held: unknown[] } };
  await expect(room.locator(".room-title p")).toHaveText(words({ needsYou: glance.glance.needsYou.length, held: glance.glance.held.length, live: glance.glance.live }));
  await expect(room.locator(".room-glance")).toBeVisible();
  await shot(page, "A room risen over the office: its photograph, its pin and what is on its bench");

  // Its menu opens from the side in stages; the workbenches are on it, and the desks hold the work in motion.
  await room.locator(".room-steer").click();
  await expect(room.getByRole("button", { name: /^The desks/ })).toBeVisible();
  await shot(page, "The room's menu: its workbenches");
  await room.getByRole("navigation").getByRole("button", { name: "Steer" }).click();
  await expect(room.getByRole("heading", { name: "Steer the room" })).toBeVisible();
  await expect(room.getByRole("radiogroup").first()).toBeVisible();
  await shot(page, "Steering the room: how far it goes on its own, how often it looks, and the work on its bench");
  await room.getByRole("navigation").getByRole("button", { name: "Bench" }).click();
  await room.getByRole("button", { name: /^The desks/ }).click();
  await expect(page.getByText(/^\d+ in motion · \d+ waiting · \d+ done\.$/)).toBeVisible();
  await page.getByRole("button", { name: "BACK TO ROOM" }).click();
  // The projects are pinned to the wall: open its bench, and they are there.
  await expect(room).toHaveClass(/is-open/);
  await room.locator(".room-steer").click();
  await room.getByRole("button", { name: /^Pinned work/ }).click();
  await expect(page.locator(".pin-card").first()).toBeVisible();
  await shot(page, "The wall desk: the projects pinned to the room");
  await page.getByRole("button", { name: "BACK TO ROOM" }).click();
  await room.getByRole("button", { name: "Back to the studio" }).click();
  await expect(room).not.toHaveClass(/is-open/);

  // A quiet pin means nothing is at work, held or waiting on you there; the room says so.
  await (await openRooms(page)).locator(".rd-room").filter({ hasText: nameOf.get(quiet!.room)! }).click();
  const still = page.getByRole("dialog", { name: nameOf.get(quiet!.room)! });
  await expect(still.locator(".room-title p")).toHaveText("quiet");
  await expect(still.locator(".room-glance")).toHaveText("Nothing on this bench right now.");
});
