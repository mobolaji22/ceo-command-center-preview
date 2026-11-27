import { expect, test } from "@playwright/test";
import { brandFontsHref, brandThemeVars, tokenSlug } from "../src/lib/brand-vars";
import { say } from "../src/copy";
import { floorFixture, roomFixture, studioFixture, type StudioInput } from "../src/lib/data/fixtures-studio";
import type { AgencyLook, OwnerData } from "../src/lib/model";

/**
 * Slice 4.0's pieces, checked without a browser (v4 ADR-0099): the brand's look reaches CSS only as plain values, the copy's slots fill,
 * and the demo's studio views tell the same story from the same records.
 */
const look = (colours: Record<string, string>): AgencyLook => ({
  colours: { surface: "#F0F0EE", text: "#111111", ...colours },
  type: { body: { family: "Serif Text", size: 17, weight: 400, tracking: 0.01, lineHeight: 1.5, typeface: null } },
  source: { assetId: "a", version: 1 },
});

test("a brand look becomes --brand-* variables; the house look sets none", () => {
  expect(brandThemeVars(null)).toEqual({});
  const vars = brandThemeVars(look({ "Signing violet": "#123456" }));
  expect(vars["--brand-surface"]).toBe("#F0F0EE");
  expect(vars["--brand-signing-violet"]).toBe("#123456");
  expect(vars["--brand-type-body-family"]).toBe('"Serif Text"');
  expect(vars["--brand-type-body-size"]).toBe("17px");
  expect(vars["--brand-type-body-tracking"]).toBe("0.01em");
  expect(tokenSlug("  ink / soft ")).toBe("ink-soft");
});

test("a value that is not a plain colour never reaches a style", () => {
  const vars = brandThemeVars(look({ accent: "url(https://example.com/x.png)", glow: "var(--x)", ok: "rgb(10, 20, 30)" }));
  expect(vars["--brand-accent"]).toBeUndefined();
  expect(vars["--brand-glow"]).toBeUndefined();
  expect(vars["--brand-ok"]).toBe("rgb(10, 20, 30)");
  const bad = brandThemeVars({ ...look({}), type: { body: { family: 'x"; } body { color: red', size: 9999, weight: 400, tracking: 0, lineHeight: 1.4, typeface: null } } });
  expect(bad["--brand-type-body-family"]).toBeUndefined();
  expect(bad["--brand-type-body-size"]).toBeUndefined();
});

test("the look's typefaces are fetched by name, once each; a name that is not a plain family is never fetched", () => {
  expect(brandFontsHref(null)).toBeNull();
  expect(brandFontsHref(look({}))).toBeNull();
  const two = { ...look({}), type: {
    body: { family: "Serif Text", size: 17, weight: 400, tracking: 0, lineHeight: 1.5, typeface: "Serif Text" },
    caption: { family: "Serif Text", size: 13, weight: 400, tracking: 0, lineHeight: 1.4, typeface: "Serif Text" },
    label: { family: "Mono Face", size: 11, weight: 500, tracking: 0.1, lineHeight: 1.2, typeface: "Mono Face" },
    evil: { family: "x", size: 11, weight: 500, tracking: 0, lineHeight: 1.2, typeface: "x&family=y" },
  } };
  expect(brandFontsHref(two)).toBe("https://fonts.googleapis.com/css2?family=Serif+Text:ital,wght@0,400;0,500;1,400&family=Mono+Face:ital,wght@0,400;0,500;1,400&display=swap");
});

test("say fills each slot and leaves a missing one visible", () => {
  expect(say("{count} waiting on your pen", { count: 2 })).toBe("2 waiting on your pen");
  expect(say("{done} of {of}", { done: 1 })).toBe("1 of {of}");
});

const at = "2026-11-20T10:00:00.000Z";
const input = (): StudioInput => ({
  data: {
    projects: [
      { id: "p-a", organization_id: "o-c", name: "Client site", status: "ACTIVE", created_at: at, started_at: at },
      { id: "p-b", organization_id: "o-own", name: "Our own site", status: "PROPOSED", created_at: at, started_at: null },
    ],
    tasks: [
      { id: "t-1", project_id: "p-a", title: "Draw the pages", domain: "Design", status: "COMPLETED", approval_required: false, created_at: at, started_at: at },
      { id: "t-2", project_id: "p-a", title: "Build the pages", domain: "Engineering", status: "BLOCKED", approval_required: false, created_at: at, started_at: at },
    ],
    approvals: [{ id: "a-2", project_id: "p-a", title: "Choose the direction", status: "REQUESTED", created_at: at }],
    organizations: [
      { id: "o-c", name: "A client", kind: "CLIENT", created_at: at },
      { id: "o-own", name: "Us", kind: "INTERNAL", created_at: at },
    ],
    events: [{ id: "e-1", created_at: "2026-11-21T10:00:00.000Z" }],
  } as unknown as OwnerData,
  rooms: ["DESIGN", "ENGINEERING"],
  roomOfDomain: (d) => (d === "Design" ? "DESIGN" : d === "Engineering" ? "ENGINEERING" : null),
  signatureOf: () => "PENCIL",
  initiatives: {},
  lastSeen: at,
  isCeo: true,
});

test("the demo's office, Floor and room agree on what needs the person and what is held", () => {
  const studio = studioFixture(input());
  expect(studio.decide.count).toBe(1);
  expect(studio.decide.items[0]).toMatchObject({ kind: "APPROVAL", room: "DESIGN", projectId: "p-a" });
  expect(studio.board).toEqual({ engagements: 2, needsYou: 1, held: 1 });
  expect(studio.know.count).toBe(1);

  const floor = floorFixture(input());
  expect(floor.groups.map((g) => g.organizationId)).toEqual(["o-c", "o-own"]);
  expect(floor.groups[1]!.studioOwn).toBe(true);
  expect(floor.groups[0]!.engagements[0]!.rooms).toEqual([{ room: "DESIGN", state: "NEEDS_YOU" }, { room: "ENGINEERING", state: "HELD" }]);

  const room = roomFixture(input(), "ENGINEERING", "CHOICES");
  expect(room.glance.held.map((h) => h.taskId)).toEqual(["t-2"]);
  expect(room.initiative).toMatchObject({ mode: 1, isDefault: true });
  expect(room.moves.find((m) => m.move === "TIGHTEN_BAR")).toMatchObject({ allowed: false });
});
