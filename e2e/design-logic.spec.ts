import { expect, test } from "@playwright/test";
import { frameToSvg, textBlockHeight } from "../src/lib/design/export";
import { applyOp } from "../src/lib/design/ops";
import { FixtureProposalProvider } from "../src/lib/design/proposals";
import { makeSampleDocument } from "../src/lib/design/sample";
import { contrast, frameTokens, isLargeText, validate, wcagLabel, type DesignDocument } from "../src/lib/design/sdd";

/**
 * The Design Workshop's rules, checked without a browser: the shape of what territory exploration hands over, the contrast maths,
 * and the governance every edit passes through (locks, scoped approvals that reopen, proposals that never touch what is locked).
 * These are pure functions over the design document, so they run anywhere.
 */
const doc = (): DesignDocument => makeSampleDocument("p1", "Northwind", "tester");
const by = "tester";
const DESKTOP = "terr-conservative-desktop";

test("the starting document has three territories, each with a desktop and a mobile frame, tokens and a full genome", () => {
  const d = doc();
  expect(d.territories.map((t) => t.posture)).toEqual(["CONSERVATIVE", "DISTINCTIVE", "EXPERIMENTAL"]);
  for (const t of d.territories) {
    expect(d.frames.filter((f) => f.territoryId === t.id).map((f) => f.viewport).sort()).toEqual(["desktop", "mobile"]);
    expect(Object.keys(t.genome)).toHaveLength(12);
    expect(Object.values(t.tokens.color).every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
  }
  expect(d.selectedTerritoryId).toBeNull();
  // the only thing wrong with it is that its images are placeholders, and it says so
  expect(validate(d).every((i) => i.includes("placeholder"))).toBe(true);
});

test("every territory's text meets WCAG AA before anyone edits it", async () => {
  const d = doc();
  for (const t of d.territories) {
    const frame = d.frames.find((f) => f.territoryId === t.id && f.viewport === "desktop")!;
    const p = await FixtureProposalProvider.propose("contrast", d, { frameId: frame.id });
    expect(p, `${t.name} has low-contrast text`).toBeNull();
  }
});

test("contrast maths: black on white is 21:1, and large text is judged against the lower threshold", () => {
  expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
  expect(wcagLabel(4.6)).toBe("AA");
  expect(wcagLabel(3.2)).toBe("Large text only");
  expect(wcagLabel(3.2, true)).toBe("AA large");
  expect(isLargeText(24, 400)).toBe(true);
  expect(isLargeText(14, 400)).toBe(false);
});

test("a locked node refuses edits, and unlocking lets them through", () => {
  const d = doc();
  const id = `${DESKTOP}-primary`;
  const locked = applyOp(d, { type: "LOCK", ids: [id], locked: true }, by).doc;
  const refused = applyOp(locked, { type: "MOVE", ids: [id], dx: 10, dy: 0 }, by);
  expect(refused.error).toMatch(/locked/i);
  expect(refused.doc).toBe(locked);
  const open = applyOp(locked, { type: "LOCK", ids: [id], locked: false }, by).doc;
  expect(applyOp(open, { type: "MOVE", ids: [id], dx: 10, dy: 0 }, by).error).toBeUndefined();
});

test("approving a frame records the revision; a material change to that frame reopens it, and a change elsewhere does not", () => {
  let d = doc();
  d = applyOp(d, { type: "APPROVE", frameIds: [DESKTOP] }, by).doc;
  const approved = d.approvals.find((a) => a.frameIds.includes(DESKTOP))!;
  expect(approved.stale).toBe(false);
  expect(approved.revision).toBe(d.revision);

  const elsewhere = applyOp(d, { type: "MOVE", ids: ["terr-distinctive-desktop-block"], dx: 8, dy: 0 }, by).doc;
  expect(elsewhere.approvals.find((a) => a.id === approved.id)!.stale).toBe(false);

  const touched = applyOp(d, { type: "PATCH", ids: [`${DESKTOP}-headline`], patch: { text: { content: "A new headline" } }, label: "Edited the text" }, by).doc;
  const reopened = touched.approvals.find((a) => a.id === approved.id)!;
  expect(reopened.stale).toBe(true);
  expect(reopened.staleReason).toMatch(/Edited the text/);
  expect(touched.decisionLog.some((e) => e.kind === "APPROVAL" && /reopened/i.test(e.summary))).toBe(true);
});

test("a token change reopens approvals for every frame of that territory only", () => {
  let d = doc();
  d = applyOp(d, { type: "APPROVE", frameIds: [DESKTOP] }, by).doc;
  d = applyOp(d, { type: "APPROVE", frameIds: ["terr-distinctive-desktop"] }, by).doc;
  const next = applyOp(d, { type: "TOKEN", territoryId: "terr-conservative", label: "Colour: accent", apply: (t) => ({ ...t, color: { ...t.color, accent: "#aa0000" } }) }, by).doc;
  const state = (frame: string) => next.approvals.find((a) => a.frameIds.includes(frame))!.stale;
  expect(state(DESKTOP)).toBe(true);
  expect(state("terr-distinctive-desktop")).toBe(false);
});

test("every committed change is a new revision with an author, and choosing a direction sets the others aside", () => {
  let d = doc();
  const r0 = d.revision;
  d = applyOp(d, { type: "SELECT_TERRITORY", id: "terr-distinctive", rationale: "Most memorable" }, "Ola").doc;
  expect(d.revision).toBe(r0 + 1);
  expect(d.revisions[d.revisions.length - 1]).toMatchObject({ n: r0 + 1, by: "Ola" });
  expect(d.selectedTerritoryId).toBe("terr-distinctive");
  expect(d.territories.map((t) => t.status)).toEqual(["SET_ASIDE", "SELECTED", "SET_ASIDE"]);
  expect(d.decisionLog[d.decisionLog.length - 1]).toMatchObject({ kind: "TERRITORY", rationale: "Most memorable" });
});

test("a contrast proposal raises failing text to the minimum, leaves locked text alone, and changes nothing until accepted", async () => {
  let d = doc();
  d = applyOp(d, { type: "TOKEN", territoryId: "terr-conservative", label: "muted", apply: (t) => ({ ...t, color: { ...t.color, textMuted: "#cfc7ba" } }) }, by).doc;
  const sub = `${DESKTOP}-sub`;
  const proposal = await FixtureProposalProvider.propose("contrast", d, { frameId: DESKTOP });
  expect(proposal).not.toBeNull();
  expect(proposal!.changes.some((c) => c.id === sub)).toBe(true);
  expect(d.nodes.find((n) => n.id === sub)!.text!.color).toEqual({ token: "textMuted" }); // untouched until accepted
  const after = proposal!.after;
  const backdrop = after.territories[0]!.tokens.color.surface;
  const fixed = after.nodes.find((n) => n.id === sub)!.text!.color;
  const hex = "hex" in fixed ? fixed.hex : after.territories[0]!.tokens.color[fixed.token];
  expect(contrast(hex, backdrop)).toBeGreaterThanOrEqual(4.5);

  const locked = applyOp(d, { type: "LOCK", ids: [sub], locked: true }, by).doc;
  const p2 = await FixtureProposalProvider.propose("contrast", locked, { frameId: DESKTOP });
  expect(p2!.changes.some((c) => c.id === sub)).toBe(false);
  expect(p2!.skipped.some((s) => s.reason === "locked")).toBe(true);
});

test("accepting a proposal is attributed and reopens approvals; setting it aside only records the decision", async () => {
  let d = doc();
  d = applyOp(d, { type: "APPROVE", frameIds: [DESKTOP] }, by).doc;
  const grid = await FixtureProposalProvider.propose("grid", d, { frameId: DESKTOP });
  expect(grid).not.toBeNull();
  const patches = grid!.changes.map((c) => ({ id: c.id, patch: c.patch }));
  const aside = applyOp(d, { type: "PROPOSAL", label: grid!.label, accepted: false, patches, rationale: "no" }, by).doc;
  expect(aside.nodes).toEqual(d.nodes);
  expect(aside.approvals[0]!.stale).toBe(false);
  const accepted = applyOp(d, { type: "PROPOSAL", label: grid!.label, accepted: true, patches, rationale: grid!.rationale }, by).doc;
  expect(accepted.approvals[0]!.stale).toBe(true);
  expect(accepted.decisionLog.some((e) => e.kind === "PROPOSAL" && /Accepted/.test(e.summary))).toBe(true);
  const again = await FixtureProposalProvider.propose("grid", accepted, { frameId: DESKTOP });
  expect(again).toBeNull(); // everything now sits on the grid
});

test("restoring a checkpoint is a new revision and brings the design back", () => {
  let d = doc();
  const snapshot = JSON.stringify({ territories: d.territories, selectedTerritoryId: d.selectedTerritoryId, frames: d.frames, nodes: d.nodes, annotations: d.annotations });
  d = applyOp(d, { type: "PATCH", ids: [`${DESKTOP}-headline`], patch: { text: { content: "Changed" } }, label: "Edited the text" }, by).doc;
  const r = d.revision;
  const back = applyOp(d, { type: "RESTORE", snapshot, name: "Start" }, by).doc;
  expect(back.revision).toBe(r + 1);
  expect(back.nodes.find((n) => n.id === `${DESKTOP}-headline`)!.text!.content).toMatch(/Good things/);
});

test("alignment and distribution move only what they should", () => {
  const d = doc();
  const ids = [`${DESKTOP}-card0`, `${DESKTOP}-card1`, `${DESKTOP}-card2`];
  const moved = applyOp(d, { type: "MOVE", ids: [ids[1]!], dx: 0, dy: 30 }, by).doc;
  const aligned = applyOp(moved, { type: "ALIGN", ids, mode: "top" }, by).doc;
  expect(new Set(ids.map((i) => aligned.nodes.find((n) => n.id === i)!.y)).size).toBe(1);
  const spread = applyOp(aligned, { type: "DISTRIBUTE", ids, axis: "x" }, by).doc;
  const xs = ids.map((i) => spread.nodes.find((n) => n.id === i)!);
  expect(xs[1]!.x - (xs[0]!.x + xs[0]!.w)).toBe(xs[2]!.x - (xs[1]!.x + xs[1]!.w));
});

test("the SVG preview carries the design and marks placeholders so they cannot be mistaken for finals", () => {
  const d = doc();
  const svg = frameToSvg(d, DESKTOP);
  expect(svg).toContain("<svg");
  expect(svg).toContain("Good things, made");
  expect(svg).toMatch(/PLACEHOLDER/);
  expect(svg).toContain(`revision ${d.revision}`);
});

test("no text in the starting designs is taller than its own box (nothing is clipped)", () => {
  const d = doc();
  const clipped = d.nodes.filter((n) => n.text && textBlockHeight(n, frameTokens(d, n.frameId)!) > n.h + 2).map((n) => `${n.frameId} / ${n.name}`);
  expect(clipped).toEqual([]);
});
