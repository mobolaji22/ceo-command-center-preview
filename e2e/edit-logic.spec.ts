import { expect, test } from "@playwright/test";
import sample from "../src/lib/design/sdd-sample.json";
import { applyOp, drawn, feedbackOn, targetWords } from "../src/lib/design/edit";
import { subtreeOf, type SddAnnotation, type SddDocument, type SddNode } from "../src/lib/design/v4";

/**
 * The Workshop's edits to v4's design document (ADR-0051 decision 5), checked without a browser on a draft v4 itself wrote. These are
 * the rules the editor keeps so a save is never refused for a reason the person could not see: boxes stay on their frame, locked
 * elements refuse changes, feedback keeps pointing at something, and no edit touches the feedback itself.
 */
const doc = () => structuredClone(sample) as SddDocument;
const frame = (d: SddDocument) => d.frames.find((f) => f.viewport === "desktop")!;
const node = (d: SddDocument, id: string) => d.nodes.find((n) => n.id === id)!;
const box = (d: SddDocument, id: string) => node(d, id).geometry.box!;
/** A child of the desktop frame's root that has children of its own, so a move or delete has something to carry. */
const group = (d: SddDocument): SddNode => {
  const f = frame(d);
  return node(d, node(d, f.rootNodeId!).children.find((c) => node(d, c).children.length > 0)!);
};
const note = (id: string, nodeId: string): SddAnnotation => ({
  id, target: { kind: "NODE", id: nodeId }, kind: "FEEDBACK", text: "Bigger, please", by: "u-client", at: "2026-10-29T00:00:00Z",
  status: "OPEN", addressedIn: null, reason: null, settledBy: null, settledAt: null,
});

test("moving an element carries everything inside it, and stops at the frame's edges", () => {
  const d = doc();
  const g = group(d);
  const inside = subtreeOf(d, g.id).filter((id) => id !== g.id);
  expect(inside.length).toBeGreaterThan(0);
  const moved = applyOp(d, { type: "MOVE", ids: [g.id], dx: 10, dy: 5 }).doc;
  for (const id of [g.id, ...inside]) {
    if (!box(d, id)) continue;
    expect(box(moved, id).x - box(d, id).x).toBe(10);
    expect(box(moved, id).y - box(d, id).y).toBe(5);
  }
  const far = applyOp(d, { type: "MOVE", ids: [g.id], dx: -100000, dy: 0 }).doc;
  expect(Math.min(...subtreeOf(d, g.id).map((id) => box(far, id).x))).toBe(0);
  const right = applyOp(d, { type: "MOVE", ids: [g.id], dx: 100000, dy: 0 }).doc;
  expect(Math.max(...subtreeOf(d, g.id).map((id) => box(right, id).x + box(right, id).w))).toBe(frame(d).width);
});

test("a resized box is kept on its frame", () => {
  const d = doc();
  const g = group(d);
  const out = applyOp(d, { type: "BOX", id: g.id, box: { x: -40, y: -10, w: 99999, h: 120 } }).doc;
  expect(box(out, g.id)).toEqual({ x: 0, y: 0, w: frame(d).width, h: 120 });
});

test("a locked element refuses edits but can still be hidden, and unlocking lets edits through", () => {
  const d = applyOp(doc(), { type: "LOCK", ids: [group(doc()).id], locked: true }).doc;
  const g = group(d);
  const refused = applyOp(d, { type: "MOVE", ids: [g.id], dx: 4, dy: 0 });
  expect(refused.error).toMatch(/locked/);
  expect(refused.doc).toBe(d);
  expect(applyOp(d, { type: "PATCH", ids: [g.id], patch: { style: { opacity: 0.5 } }, label: "Opacity" }).error).toMatch(/locked/);
  expect(node(applyOp(d, { type: "PATCH", ids: [g.id], patch: { hidden: true }, label: "Hidden" }).doc, g.id).hidden).toBe(true);
  const open = applyOp(d, { type: "LOCK", ids: [g.id], locked: false }).doc;
  expect(applyOp(open, { type: "MOVE", ids: [g.id], dx: 4, dy: 0 }).error).toBeUndefined();
});

test("deleting takes an element and everything inside it out of its parent and frame; a frame's outermost element stays", () => {
  const d = doc();
  const g = group(d);
  const gone = subtreeOf(d, g.id);
  const out = applyOp(d, { type: "DELETE", ids: [g.id] }).doc;
  for (const id of gone) expect(out.nodes.some((n) => n.id === id)).toBe(false);
  expect(frame(out).nodeIds.some((id) => gone.includes(id))).toBe(false);
  expect(node(out, g.parentId!).children).not.toContain(g.id);
  expect(applyOp(d, { type: "DELETE", ids: [frame(d).rootNodeId!] }).error).toMatch(/outermost/);
});

test("an element with feedback on it, or on anything inside it, is hidden rather than deleted, so the feedback keeps its place", () => {
  const d = doc();
  const g = group(d);
  const child = g.children[0]!;
  const noted = { ...d, annotations: [note("a1", child)] };
  const r = applyOp(noted, { type: "DELETE", ids: [g.id] });
  expect(r.error).toMatch(/hide/);
  expect(r.doc).toBe(noted);
});

test("duplicating copies the whole element with fresh ids next to the original, on the same frame", () => {
  const d = doc();
  const g = group(d);
  const size = subtreeOf(d, g.id).length;
  const out = applyOp(d, { type: "DUPLICATE", ids: [g.id] }).doc;
  expect(out.nodes.length).toBe(d.nodes.length + size);
  const parent = node(out, g.parentId!);
  const copyId = parent.children[parent.children.indexOf(g.id) + 1]!;
  expect(copyId).not.toBe(g.id);
  expect(subtreeOf(out, copyId).length).toBe(size);
  expect(new Set(out.nodes.map((n) => n.id)).size).toBe(out.nodes.length);
  expect(frame(out).nodeIds).toContain(copyId);
  expect(applyOp(d, { type: "DUPLICATE", ids: [frame(d).rootNodeId!] }).error).toBeDefined();
});

test("layer order is the order of a parent's children", () => {
  const d = doc();
  const root = node(d, frame(d).rootNodeId!);
  const [first] = root.children;
  expect(node(applyOp(d, { type: "ORDER", ids: [first!], to: "front" }).doc, root.id).children.at(-1)).toBe(first);
  const up = node(applyOp(d, { type: "ORDER", ids: [first!], to: "up" }).doc, root.id).children;
  expect(up[1]).toBe(first);
  expect(up[0]).toBe(root.children[1]);
});

test("alignment and distribution move only what they should, and carry what is inside", () => {
  const d = doc();
  const kids = node(d, frame(d).rootNodeId!).children.slice(0, 3);
  const left = applyOp(d, { type: "ALIGN", ids: kids, mode: "left" }).doc;
  const l = Math.min(...kids.map((id) => box(d, id).x));
  for (const id of kids) expect(box(left, id).x).toBe(l);
  const untouched = d.nodes.filter((n) => !kids.some((k) => subtreeOf(d, k).includes(n.id)) && n.geometry.box);
  for (const n of untouched) expect(box(left, n.id)).toEqual(n.geometry.box);
  const spread = applyOp(d, { type: "DISTRIBUTE", ids: kids, axis: "y" }).doc;
  const sorted = [...kids].sort((a, b) => box(d, a).y - box(d, b).y);
  const gaps = sorted.slice(1).map((id, i) => box(spread, id).y - (box(spread, sorted[i]!).y + box(spread, sorted[i]!).h));
  expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
  expect(applyOp(d, { type: "DISTRIBUTE", ids: kids.slice(0, 2), axis: "y" }).doc).toBe(d);
});

test("a token change belongs to its territory only", () => {
  const d = doc();
  const [a, b] = d.territories;
  const tokens = { ...a!.tokens!, colour: { ...a!.tokens!.colour, surface: "#101010" } };
  const out = applyOp(d, { type: "TOKENS", territoryId: a!.id, tokens, label: "Surface" }).doc;
  expect(out.territories[0]!.tokens!.colour.surface).toBe("#101010");
  expect(out.territories[1]).toEqual(b);
});

test("restoring a version brings its design back but keeps this revision's identity and feedback", () => {
  const d = { ...doc(), annotations: [note("a1", group(doc()).id)] };
  const old = applyOp(doc(), { type: "MOVE", ids: [group(doc()).id], dx: 30, dy: 0 }).doc;
  const out = applyOp(d, { type: "RESTORE", doc: { ...old, revision: 1, status: "APPROVED", annotations: [] }, label: "Restored version 1" }).doc;
  expect(out.nodes).toEqual(old.nodes);
  expect(out.revision).toBe(d.revision);
  expect(out.status).toBe(d.status);
  expect(out.annotations).toEqual(d.annotations);
});

test("no edit changes the feedback", () => {
  const d = { ...doc(), annotations: [note("a1", group(doc()).id)] };
  const g = group(d);
  for (const op of [
    { type: "MOVE", ids: [g.id], dx: 3, dy: 3 },
    { type: "DUPLICATE", ids: [g.id] },
    { type: "PATCH", ids: [g.id], patch: { role: "renamed" }, label: "Role" },
    { type: "ORDER", ids: [g.id], to: "back" },
  ] as const) expect(applyOp(d, op).doc.annotations).toBe(d.annotations);
});

test("feedback is shown on the frame it is about, and named in words", () => {
  const d = doc();
  const g = group(d);
  const other = d.frames.find((f) => f.territoryId !== frame(d).territoryId)!;
  const withNotes = { ...d, annotations: [note("a1", g.id), { ...note("a2", g.id), target: { kind: "DOCUMENT" as const, id: null } }] };
  expect(feedbackOn(withNotes, frame(d)).map((a) => a.id)).toEqual(["a1", "a2"]);
  expect(feedbackOn(withNotes, other).map((a) => a.id)).toEqual(["a2"]);
  expect(targetWords(d, { kind: "NODE", id: g.id })).toBe(g.role);
  expect(targetWords(d, { kind: "DOCUMENT", id: null })).toBe("the whole design");
  expect(targetWords(d, { kind: "NODE", id: "gone" })).toMatch(/no longer/);
});

test("every element v4 placed is drawn", () => {
  const d = doc();
  for (const f of d.frames) expect(drawn(d, f).length).toBe(f.nodeIds.length);
});
