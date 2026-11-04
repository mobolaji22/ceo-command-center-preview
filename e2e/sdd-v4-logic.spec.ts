import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import sample from "../src/lib/design/sdd-sample.json";
import { effectsCss, fillCss, fontOf, mediaLine, mediaOf, motionLine, choosing, contrast, documentOf, framesOf, isLargeText, paintHex, slotOf, surfaceUnder, tokenLines, tokensOf, treeOf, typeStyleOf, wcagLabel, type NodeTree, type SddDocument } from "../src/lib/design/v4";

/**
 * Reading v4's design document (dev-playbook-v4 ADR-0049), checked without a browser on a document v4 itself wrote: the sample is a
 * territory exploration draft, so these hold for what the Workshop is given, not for a shape this repo invented.
 */
const doc = () => structuredClone(sample) as SddDocument;
const count = (t: NodeTree): number => 1 + t.children.reduce((n, c) => n + count(c), 0);

test("each territory has its key frames, and each frame's nodes form one tree from its root", () => {
  const d = doc();
  for (const t of d.territories) {
    const frames = framesOf(d, t.id);
    expect(frames.map((f) => f.viewport)).toEqual(["desktop", "phone"]);
    for (const f of frames) {
      const tree = treeOf(d, f)!;
      expect(tree.node.id).toBe(f.rootNodeId);
      expect(count(tree)).toBe(f.nodeIds.length);
    }
  }
});

test("a node that loops back to an ancestor is drawn once, not forever", () => {
  const d = doc();
  const frame = framesOf(d, d.territories[0]!.id)[0]!;
  const root = d.nodes.find((n) => n.id === frame.rootNodeId)!;
  const child = d.nodes.find((n) => n.parentId === root.id && frame.nodeIds.includes(n.id))!;
  root.parentId = child.id;
  expect(count(treeOf(d, frame)!)).toBe(frame.nodeIds.length);
});

test("words on a frame are slots for Content, with a purpose, never the copy itself", () => {
  const d = doc();
  const slots = d.nodes.map(slotOf).filter((s) => s !== null);
  expect(slots.length).toBeGreaterThan(0);
  for (const s of slots) expect(s.purpose).not.toBe("");
});

test("a direction is being chosen until the document names one; the draft is read before the approved document", () => {
  const d = doc();
  expect(choosing(d)).toBe(true);
  expect(choosing({ ...d, selectedTerritoryId: d.territories[1]!.id })).toBe(false);
  expect(choosing(null)).toBe(false);
  const approved = { version: 1, revision: 1, approvedAt: "2026-10-28T00:00:00Z", document: { ...d, selectedTerritoryId: "x" } };
  expect(documentOf({ approved, current: null, annotations: [] })?.selectedTerritoryId).toBe("x");
  expect(documentOf({ approved, current: { proposalId: "p", status: "DRAFT", baseVersion: 1, documentHash: "h", document: d }, annotations: [] })).toBe(d);
});

test("a territory's tokens read out as group, name and value", () => {
  const lines = tokenLines(doc().territories[0]!);
  expect(lines.length).toBeGreaterThan(0);
  for (const l of lines) for (const v of [l.group, l.name, l.value]) expect(v).not.toBe("");
});

test("contrast maths: black on white is 21:1, and large text is judged against the lower threshold", () => {
  expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
  expect(wcagLabel(4.6)).toBe("AA");
  expect(wcagLabel(3.2)).toBe("Large text only");
  expect(wcagLabel(3.2, true)).toBe("AA large");
  expect(isLargeText(24, 400)).toBe(true);
  expect(isLargeText(19, 700)).toBe(true);
  expect(isLargeText(16, 700)).toBe(false);
});

test("every word slot v4 drew reads at AA against the surface under it, with its territory's own tokens", () => {
  const d = doc();
  for (const f of d.frames) {
    const t = tokensOf(d, f)!;
    for (const id of f.nodeIds) {
      const n = d.nodes.find((x) => x.id === id)!;
      if (!n.text) continue;
      const style = typeStyleOf(t, n.text.style)!;
      const ratio = contrast(paintHex(n.text.colour, t), surfaceUnder(d, n, t));
      expect(wcagLabel(ratio, isLargeText(n.text.size ?? style.size, style.weight)), `${n.id} at ${ratio.toFixed(2)}`).not.toMatch(/Fails|Large text only/);
    }
  }
});

/* Version 4 (dev-playbook-v4 ADR-0057 Decision 4), drawn as v4's renderer draws it (ADR-0060), on the sample v4 wrote. */
const node = (d: SddDocument, id: string) => d.nodes.find((n) => n.id === id)!;
const DESKTOP = "territory.distinctive.desktop";

test("a gradient fill, a shadow and a turn are drawn as CSS from the direction's own tokens", () => {
  const d = doc();
  const ticket = node(d, `${DESKTOP}.ticket`);
  const t = tokensOf(d, d.frames.find((f) => f.id === DESKTOP))!;
  expect(fillCss(ticket.style.fill, t)).toMatch(/^linear-gradient\(135deg, #[0-9A-Fa-f]{6} 0%, #[0-9A-Fa-f]{6} 100%\)$/);
  const fx = effectsCss(ticket.style, t);
  expect(fx.boxShadow).toMatch(/^0px 12px 32px 0px #[0-9A-Fa-f]{6}59$/);
  expect(fx.transform).toBe("rotate(-2deg)");
  const headline = node(d, `${DESKTOP}.headline`);
  expect(fontOf(typeStyleOf(t, headline.text!.style)!)).toMatch(/^"Space Grotesk", /);
  expect(motionLine(headline.motion[0]!, t)).toBe("On load, it fades, moves over 600ms; with reduced motion, a short fade.");
});

test("material no Asset holds says what it is and how it is to be had, never an invented image", () => {
  const d = doc();
  const media = mediaOf(d, node(d, `${DESKTOP}.roastery`))!;
  expect(mediaLine(media)).toBe("Photograph: The roaster at the drum (21:9), requested from the client");
  expect(node(d, `${DESKTOP}.orb`).scene?.fallback).toBeTruthy();
});

test("each direction holds a study of every key frame, and the demo serves each one", () => {
  for (const t of doc().territories) {
    expect(t.rendered).toBe(true);
    expect(t.previewRefs).toHaveLength(t.keyFrameIds.length);
    for (const file of t.previewRefs) expect(existsSync(`public/fixtures/studies/${file}`), file).toBe(true);
  }
});
