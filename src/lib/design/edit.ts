import { frameOfNode, nodesOf, subtreeOf, type AnnotationTarget, type SddAnnotation, type SddBox, type SddDocument, type SddFrame, type SddNode, type SddText, type SddTokens } from "./v4";

/**
 * Every change the Workshop makes to v4's design document is one of these operations (ADR-0051 decision 5). They are plain data,
 * applied in one place, so the undo stack is a list of documents and every change is checked the same way: a locked node refuses
 * edits, and a box stays on its frame (v4 refuses a box that runs off it). They change only the design: annotations are appended and
 * settled through v4's own routes, and v4 refuses a save that touches them, so no operation here does.
 */
export type Align = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type NodePatch = { role?: string; hidden?: boolean; style?: Partial<SddNode["style"]>; text?: Partial<SddText> };

export type Op =
  | { type: "MOVE"; ids: string[]; dx: number; dy: number }
  | { type: "BOX"; id: string; box: SddBox }
  | { type: "PATCH"; ids: string[]; patch: NodePatch; label: string }
  | { type: "DELETE"; ids: string[] }
  | { type: "DUPLICATE"; ids: string[] }
  | { type: "ORDER"; ids: string[]; to: "front" | "back" | "up" | "down" }
  | { type: "LOCK"; ids: string[]; locked: boolean }
  | { type: "ALIGN"; ids: string[]; mode: Align }
  | { type: "DISTRIBUTE"; ids: string[]; axis: "x" | "y" }
  /** A territory's tokens, or the document's when `territoryId` is null. Every node that refers to a token follows. */
  | { type: "TOKENS"; territoryId: string | null; tokens: SddTokens; label: string }
  /** An approved version as the design again. The feedback stays as it is: it belongs to the revision being worked on. */
  | { type: "RESTORE"; doc: SddDocument; label: string };

export type Applied = { doc: SddDocument; summary: string; error?: string };

const nameOf = (n: SddNode) => n.role || n.type;
const named = (d: SddDocument, ids: string[]) => (ids.length === 1 ? (d.nodes.find((n) => n.id === ids[0]) ? nameOf(d.nodes.find((n) => n.id === ids[0])!) : "an element") : `${ids.length} elements`);
const boxOf = (n: SddNode) => n.geometry.box;
const withBox = (n: SddNode, box: SddBox): SddNode => ({ ...n, geometry: { ...n.geometry, box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.max(1, Math.round(box.w)), h: Math.max(1, Math.round(box.h)) } } });

/** The nodes an operation moves: the ones named, and everything inside them, each once. */
function carried(d: SddDocument, ids: string[]): Set<string> {
  return new Set(ids.flatMap((id) => subtreeOf(d, id)));
}

/** How far a set of boxes may move and stay on the frame: not past its left, top or right edge (v4's rule), nor below its height. */
function clampMove(boxes: SddBox[], frame: SddFrame | undefined, dx: number, dy: number): { dx: number; dy: number } {
  if (!boxes.length) return { dx: 0, dy: 0 };
  const l = Math.min(...boxes.map((b) => b.x)), t = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w)), b = Math.max(...boxes.map((x) => x.y + x.h));
  const maxX = frame?.width != null ? frame.width - r : Infinity;
  const maxY = frame?.height != null ? frame.height - b : Infinity;
  return { dx: Math.max(-l, Math.min(dx, Math.max(0, maxX))), dy: Math.max(-t, Math.min(dy, Math.max(0, maxY))) };
}

/** A box kept on its frame: never left of or above it, never past its right edge. */
export function onFrame(box: SddBox, frame: SddFrame | undefined): SddBox {
  const w = frame?.width != null ? Math.min(box.w, frame.width) : box.w;
  const x = Math.max(0, frame?.width != null ? Math.min(box.x, frame.width - w) : box.x);
  return { x, y: Math.max(0, box.y), w, h: box.h };
}

const lockedNames = (d: SddDocument, ids: string[]) => d.nodes.filter((n) => ids.includes(n.id) && n.locked).map(nameOf);

/** A copy of a node and everything inside it, with fresh ids, placed under the same parent. */
function copySubtree(d: SddDocument, id: string, stamp: string): SddNode[] {
  const ids = subtreeOf(d, id);
  const fresh = new Map(ids.map((x, i) => [x, `${x}.copy-${stamp}${i ? `-${i}` : ""}`.slice(-120)]));
  return ids.map((x) => {
    const n = d.nodes.find((y) => y.id === x)!;
    const box = boxOf(n);
    return {
      ...n, id: fresh.get(x)!, parentId: n.parentId && fresh.has(n.parentId) ? fresh.get(n.parentId)! : n.parentId,
      children: n.children.map((c) => fresh.get(c) ?? c), locked: false,
      geometry: { ...n.geometry, box: box ? { ...box, x: box.x + 16, y: box.y + 16 } : null },
    };
  });
}

export function applyOp(d: SddDocument, op: Op): Applied {
  const refuse = (error: string): Applied => ({ doc: d, summary: "", error });
  const refuseLocked = (names: string[]) => refuse(`${names.join(", ")} ${names.length === 1 ? "is" : "are"} locked. Unlock to change.`);
  const done = (doc: SddDocument, summary: string): Applied => ({ doc, summary });
  const nodes = (f: (n: SddNode) => SddNode) => d.nodes.map(f);

  switch (op.type) {
    case "MOVE": {
      const lk = lockedNames(d, op.ids); if (lk.length) return refuseLocked(lk);
      const moving = carried(d, op.ids);
      const boxes = d.nodes.filter((n) => moving.has(n.id)).flatMap((n) => (boxOf(n) ? [boxOf(n)!] : []));
      const { dx, dy } = clampMove(boxes, frameOfNode(d, op.ids[0] ?? ""), op.dx, op.dy);
      if (!dx && !dy) return { doc: d, summary: "" };
      return done({ ...d, nodes: nodes((n) => { const b = boxOf(n); return moving.has(n.id) && b ? withBox(n, { ...b, x: b.x + dx, y: b.y + dy }) : n; }) }, `Moved ${named(d, op.ids)}`);
    }
    case "BOX": {
      const lk = lockedNames(d, [op.id]); if (lk.length) return refuseLocked(lk);
      const box = onFrame(op.box, frameOfNode(d, op.id));
      return done({ ...d, nodes: nodes((n) => (n.id === op.id ? withBox(n, box) : n)) }, `Resized ${named(d, [op.id])}`);
    }
    case "PATCH": {
      // Hiding and showing are allowed on a locked node: they change what is seen, not the node.
      const visibilityOnly = Object.keys(op.patch).every((k) => k === "hidden");
      const lk = visibilityOnly ? [] : lockedNames(d, op.ids); if (lk.length) return refuseLocked(lk);
      const { style, text, ...rest } = op.patch;
      return done({
        ...d,
        nodes: nodes((n) => (op.ids.includes(n.id) ? { ...n, ...rest, style: style ? { ...n.style, ...style } : n.style, text: text && n.text ? { ...n.text, ...text } : n.text } : n)),
      }, `${op.label} on ${named(d, op.ids)}`);
    }
    case "DELETE": {
      const lk = lockedNames(d, op.ids); if (lk.length) return refuseLocked(lk);
      const roots = d.frames.filter((f) => f.rootNodeId && op.ids.includes(f.rootNodeId));
      if (roots.length) return refuse("A frame's outermost element holds the frame together and cannot be deleted.");
      const gone = carried(d, op.ids);
      // Feedback must keep pointing at something (v4 checks every annotation's target), so an element with feedback is hidden instead.
      const noted = d.annotations.filter((a) => a.target.kind === "NODE" && a.target.id && gone.has(a.target.id));
      if (noted.length) return refuse(`${named(d, op.ids)} ${op.ids.length === 1 ? "has" : "have"} feedback on ${op.ids.length === 1 ? "it" : "them"}, so ${op.ids.length === 1 ? "it stays" : "they stay"}: hide ${op.ids.length === 1 ? "it" : "them"} instead.`);
      return done({
        ...d,
        nodes: d.nodes.filter((n) => !gone.has(n.id)).map((n) => (n.children.some((c) => gone.has(c)) ? { ...n, children: n.children.filter((c) => !gone.has(c)) } : n)),
        frames: d.frames.map((f) => (f.nodeIds.some((x) => gone.has(x)) ? { ...f, nodeIds: f.nodeIds.filter((x) => !gone.has(x)) } : f)),
      }, `Deleted ${named(d, op.ids)}`);
    }
    case "DUPLICATE": {
      // A node inside another that is also being copied comes along with it, once.
      const tops = op.ids.filter((id) => !op.ids.some((o) => o !== id && subtreeOf(d, o).includes(id)));
      const stamp = Date.now().toString(36);
      let doc = d;
      for (const id of tops) {
        const n = doc.nodes.find((x) => x.id === id);
        const frame = frameOfNode(doc, id);
        if (!n || !n.parentId || !frame) continue;
        const copies = copySubtree(doc, id, stamp).map((c) => (boxOf(c) ? withBox(c, onFrame(boxOf(c)!, frame)) : c));
        const top = copies[0]!;
        doc = {
          ...doc,
          nodes: [...doc.nodes.map((x) => (x.id === n.parentId ? { ...x, children: x.children.flatMap((c) => (c === id ? [c, top.id] : [c])) } : x)), ...copies],
          frames: doc.frames.map((f) => (f.id === frame.id ? { ...f, nodeIds: [...f.nodeIds, ...copies.map((c) => c.id)] } : f)),
        };
      }
      return doc === d ? refuse("A frame's outermost element cannot be duplicated.") : done(doc, `Duplicated ${named(d, op.ids)}`);
    }
    case "ORDER": {
      // Drawing order is the order of a parent's children: later is on top.
      const parents = new Set(d.nodes.filter((n) => op.ids.includes(n.id) && n.parentId).map((n) => n.parentId!));
      const reorder = (children: string[]) => {
        const sel = children.filter((c) => op.ids.includes(c));
        if (op.to === "front") return [...children.filter((c) => !op.ids.includes(c)), ...sel];
        if (op.to === "back") return [...sel, ...children.filter((c) => !op.ids.includes(c))];
        const out = [...children];
        const order = op.to === "up" ? [...sel].reverse() : sel;
        for (const id of order) {
          const i = out.indexOf(id), j = i + (op.to === "up" ? 1 : -1);
          if (j >= 0 && j < out.length && !op.ids.includes(out[j]!)) { out[i] = out[j]!; out[j] = id; }
        }
        return out;
      };
      return done({ ...d, nodes: nodes((n) => (parents.has(n.id) ? { ...n, children: reorder(n.children) } : n)) }, `Layer order: ${op.to === "front" ? "to front" : op.to === "back" ? "to back" : op.to === "up" ? "forward" : "backward"}`);
    }
    case "LOCK":
      return done({ ...d, nodes: nodes((n) => (op.ids.includes(n.id) ? { ...n, locked: op.locked } : n)) }, `${op.locked ? "Locked" : "Unlocked"} ${named(d, op.ids)}`);
    case "ALIGN": {
      const sel = d.nodes.filter((n) => op.ids.includes(n.id) && boxOf(n));
      const lk = lockedNames(d, op.ids); if (lk.length) return refuseLocked(lk);
      if (!sel.length) return { doc: d, summary: "" };
      // One element aligns within its parent; several align to each other.
      const parent = sel.length === 1 && sel[0]!.parentId ? d.nodes.find((n) => n.id === sel[0]!.parentId) : undefined;
      const area = sel.length > 1 || !parent || !boxOf(parent)
        ? { l: Math.min(...sel.map((n) => boxOf(n)!.x)), t: Math.min(...sel.map((n) => boxOf(n)!.y)), r: Math.max(...sel.map((n) => boxOf(n)!.x + boxOf(n)!.w)), b: Math.max(...sel.map((n) => boxOf(n)!.y + boxOf(n)!.h)) }
        : { l: boxOf(parent)!.x, t: boxOf(parent)!.y, r: boxOf(parent)!.x + boxOf(parent)!.w, b: boxOf(parent)!.y + boxOf(parent)!.h };
      const shift = new Map<string, { dx: number; dy: number }>();
      for (const n of sel) {
        const b = boxOf(n)!, m = op.mode;
        const x = m === "left" ? area.l : m === "right" ? area.r - b.w : m === "center" ? Math.round((area.l + area.r) / 2 - b.w / 2) : b.x;
        const y = m === "top" ? area.t : m === "bottom" ? area.b - b.h : m === "middle" ? Math.round((area.t + area.b) / 2 - b.h / 2) : b.y;
        for (const id of subtreeOf(d, n.id)) shift.set(id, { dx: x - b.x, dy: y - b.y });
      }
      return done({ ...d, nodes: nodes((n) => { const s = shift.get(n.id), b = boxOf(n); return s && b ? withBox(n, { ...b, x: b.x + s.dx, y: b.y + s.dy }) : n; }) }, `Aligned ${op.mode}`);
    }
    case "DISTRIBUTE": {
      const sel = d.nodes.filter((n) => op.ids.includes(n.id) && boxOf(n)).sort((a, b) => (op.axis === "x" ? boxOf(a)!.x - boxOf(b)!.x : boxOf(a)!.y - boxOf(b)!.y));
      if (sel.length < 3) return { doc: d, summary: "" };
      const lk = lockedNames(d, op.ids); if (lk.length) return refuseLocked(lk);
      const size = (n: SddNode) => (op.axis === "x" ? boxOf(n)!.w : boxOf(n)!.h);
      const start = (n: SddNode) => (op.axis === "x" ? boxOf(n)!.x : boxOf(n)!.y);
      const first = sel[0]!, last = sel[sel.length - 1]!;
      const gap = (start(last) + size(last) - start(first) - sel.reduce((a, n) => a + size(n), 0)) / (sel.length - 1);
      let cursor = start(first);
      const shift = new Map<string, number>();
      for (const n of sel) { const by = Math.round(cursor) - start(n); for (const id of subtreeOf(d, n.id)) shift.set(id, by); cursor += size(n) + gap; }
      return done({ ...d, nodes: nodes((n) => { const s = shift.get(n.id), b = boxOf(n); return s !== undefined && b ? withBox(n, op.axis === "x" ? { ...b, x: b.x + s } : { ...b, y: b.y + s }) : n; }) }, `Distributed ${sel.length} elements ${op.axis === "x" ? "across" : "down"}`);
    }
    case "TOKENS":
      return op.territoryId === null
        ? done({ ...d, tokens: op.tokens }, op.label)
        : done({ ...d, territories: d.territories.map((t) => (t.id === op.territoryId ? { ...t, tokens: op.tokens } : t)) }, op.label);
    case "RESTORE":
      return done({ ...op.doc, documentId: d.documentId, projectId: d.projectId, tenantId: d.tenantId, revision: d.revision, status: d.status, annotations: d.annotations }, op.label);
  }
}

/** The document with v4's latest feedback in it, after an annotation was added or settled: the design itself is left as it is. */
export const withAnnotations = (d: SddDocument, annotations: SddAnnotation[]): SddDocument => ({ ...d, annotations });

/** The feedback on one frame and the elements in it, and on the frame's territory. */
export function feedbackOn(d: SddDocument, frame: SddFrame): SddAnnotation[] {
  const inFrame = new Set(frame.nodeIds);
  return d.annotations.filter((a) => (a.target.kind === "NODE" && a.target.id !== null && inFrame.has(a.target.id)) || (a.target.kind === "FRAME" && a.target.id === frame.id) || (a.target.kind === "TERRITORY" && a.target.id === frame.territoryId) || a.target.kind === "DOCUMENT");
}

/** What an annotation is about, in words. */
export function targetWords(d: SddDocument, target: AnnotationTarget): string {
  const id = target.id;
  if (target.kind === "DOCUMENT") return "the whole design";
  if (target.kind === "TERRITORY") return d.territories.find((t) => t.id === id)?.concept ?? "a direction";
  if (target.kind === "FRAME") { const f = d.frames.find((x) => x.id === id); return f ? `the ${f.viewport ?? ""} frame`.replace("  ", " ") : "a frame"; }
  const n = d.nodes.find((x) => x.id === id);
  return n ? nameOf(n) : "an element no longer in the design";
}

/** Which elements of a frame are drawn at all: those with a box. */
export const drawn = (d: SddDocument, frame: SddFrame): SddNode[] => nodesOf(d, frame).filter((n) => boxOf(n) !== null);
