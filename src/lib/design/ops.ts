import { frameTokens, nodesOf, type Annotation, type Decision, type DecisionKind, type DesignDocument, type Frame, type GenomeEntry, type GenomeKey, type Paint, type Radius, type SNode, type Tokens } from "./sdd";

/**
 * Every change to a design is one of these operations. They are plain data, applied in one place, so every change is
 * attributable (who, what, why), recoverable (history and checkpoints), and checked the same way: locked nodes refuse edits,
 * and a material change reopens any approval it touches. This is the Workshop's whole write path.
 */
export type Align = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type NodePatch = Partial<Pick<SNode, "name" | "role" | "x" | "y" | "w" | "h" | "opacity" | "radius" | "fill" | "stroke" | "hidden">> & { text?: Partial<NonNullable<SNode["text"]>> };

export type Op =
  | { type: "MOVE"; ids: string[]; dx: number; dy: number }
  | { type: "RECT"; id: string; x: number; y: number; w: number; h: number }
  | { type: "PATCH"; ids: string[]; patch: NodePatch; label: string }
  | { type: "ADD"; node: SNode }
  | { type: "DELETE"; ids: string[] }
  | { type: "DUPLICATE"; ids: string[] }
  | { type: "ORDER"; ids: string[]; to: "front" | "back" | "up" | "down" }
  | { type: "LOCK"; ids: string[]; locked: boolean }
  | { type: "GROUP"; ids: string[]; group: string | undefined }
  | { type: "ALIGN"; ids: string[]; mode: Align }
  | { type: "DISTRIBUTE"; ids: string[]; axis: "x" | "y" }
  | { type: "TOKEN"; territoryId: string; apply: (t: Tokens) => Tokens; label: string }
  | { type: "GENOME"; territoryId: string; key: GenomeKey; patch: Partial<GenomeEntry> }
  | { type: "SELECT_TERRITORY"; id: string; rationale: string }
  | { type: "FRAME_VARIANT"; frameId: string }
  | { type: "ANNOTATE"; note: Annotation }
  | { type: "NOTE_EDIT"; id: string; patch: Partial<Pick<Annotation, "text" | "resolved">> }
  | { type: "NOTE_DELETE"; id: string }
  | { type: "DECIDE"; summary: string; rationale: string }
  | { type: "APPROVE"; frameIds: string[] }
  | { type: "PROPOSAL"; label: string; accepted: boolean; patches: { id: string; patch: NodePatch }[]; rationale: string }
  | { type: "RESTORE"; snapshot: string; name: string }
  | { type: "IMPORT"; doc: DesignDocument };

export type Applied = { doc: DesignDocument; summary: string; error?: string };
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
const same = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** What a checkpoint remembers: the design itself, not the history around it. */
export const snapshotOf = (d: DesignDocument) => JSON.stringify({ territories: d.territories, selectedTerritoryId: d.selectedTerritoryId, frames: d.frames, nodes: d.nodes, annotations: d.annotations });

export function describeFrame(d: DesignDocument, id: string) { return d.frames.find((f) => f.id === id)?.name ?? "a frame"; }

function log(d: DesignDocument, by: string, kind: DecisionKind, summary: string, affected: string[], rationale?: string): Decision[] {
  const entry: Decision = { id: uid("dec"), at: new Date().toISOString(), by, kind, summary, rationale, affected };
  return [...d.decisionLog, entry].slice(-300);
}

/** Reopen approvals whose frames were touched, and say why. */
function reopen(d: DesignDocument, frameIds: Set<string>, reason: string): { approvals: DesignDocument["approvals"]; reopened: string[] } {
  const reopened: string[] = [];
  const approvals = d.approvals.map((a) => {
    if (a.stale || !a.frameIds.some((f) => frameIds.has(f))) return a;
    reopened.push(...a.frameIds.filter((f) => frameIds.has(f)));
    return { ...a, stale: true, staleReason: reason };
  });
  return { approvals, reopened };
}

const locked = (d: DesignDocument, ids: string[]) => d.nodes.filter((n) => ids.includes(n.id) && n.locked).map((n) => n.name);

export function applyOp(d: DesignDocument, op: Op, by: string): Applied {
  const touchFrames = new Set<string>();
  const nextRev = d.revision + 1;
  const finish = (doc: DesignDocument, summary: string, kind: DecisionKind | null, affected: string[], rationale?: string, material = true): Applied => {
    let approvals = doc.approvals;
    let decisionLog = doc.decisionLog;
    if (material && touchFrames.size) {
      const r = reopen(doc, touchFrames, `Changed in r${nextRev}: ${summary}`);
      approvals = r.approvals;
      if (r.reopened.length) decisionLog = log({ ...doc, decisionLog }, by, "APPROVAL", `Approval reopened for ${[...new Set(r.reopened)].map((f) => describeFrame(doc, f)).join(", ")}`, [...new Set(r.reopened)], `A material change was made: ${summary}`);
    }
    const withKind = kind ? log({ ...doc, decisionLog }, by, kind, summary, affected, rationale) : decisionLog;
    return { doc: { ...doc, approvals, decisionLog: withKind, revision: nextRev, revisions: [...doc.revisions, { n: nextRev, at: new Date().toISOString(), by, summary }].slice(-200) }, summary };
  };
  const refuse = (names: string[]): Applied => ({ doc: d, summary: "", error: `${names.join(", ")} ${names.length === 1 ? "is" : "are"} locked. Unlock to change.` });

  switch (op.type) {
    case "MOVE": {
      const lk = locked(d, op.ids); if (lk.length) return refuse(lk);
      const nodes = d.nodes.map((n) => (op.ids.includes(n.id) ? (touchFrames.add(n.frameId), { ...n, x: Math.round(n.x + op.dx), y: Math.round(n.y + op.dy) }) : n));
      return finish({ ...d, nodes }, `Moved ${op.ids.length === 1 ? (d.nodes.find((n) => n.id === op.ids[0])?.name ?? "a node") : `${op.ids.length} nodes`}`, null, op.ids);
    }
    case "RECT": {
      const lk = locked(d, [op.id]); if (lk.length) return refuse(lk);
      const nodes = d.nodes.map((n) => (n.id === op.id ? (touchFrames.add(n.frameId), { ...n, x: Math.round(op.x), y: Math.round(op.y), w: Math.max(4, Math.round(op.w)), h: Math.max(4, Math.round(op.h)) }) : n));
      return finish({ ...d, nodes }, `Resized ${d.nodes.find((n) => n.id === op.id)?.name ?? "a node"}`, null, [op.id]);
    }
    case "PATCH": {
      const lk = locked(d, op.ids); if (lk.length) return refuse(lk);
      const nodes = d.nodes.map((n) => {
        if (!op.ids.includes(n.id)) return n;
        touchFrames.add(n.frameId);
        const { text, ...rest } = op.patch;
        const next: SNode = { ...n, ...rest };
        if (text && n.text) next.text = { ...n.text, ...text };
        return next;
      });
      return finish({ ...d, nodes }, `${op.label}${op.ids.length === 1 ? ` on ${d.nodes.find((n) => n.id === op.ids[0])?.name ?? "a node"}` : ` on ${op.ids.length} nodes`}`, null, op.ids);
    }
    case "ADD": { touchFrames.add(op.node.frameId); return finish({ ...d, nodes: [...d.nodes, op.node] }, `Added ${op.node.name}`, null, [op.node.id]); }
    case "DELETE": {
      const lk = locked(d, op.ids); if (lk.length) return refuse(lk);
      d.nodes.filter((n) => op.ids.includes(n.id)).forEach((n) => touchFrames.add(n.frameId));
      return finish({ ...d, nodes: d.nodes.filter((n) => !op.ids.includes(n.id)), annotations: d.annotations.map((a) => (a.nodeId && op.ids.includes(a.nodeId) ? { ...a, nodeId: null } : a)) }, `Deleted ${op.ids.length} node${op.ids.length === 1 ? "" : "s"}`, null, op.ids);
    }
    case "DUPLICATE": {
      const copies = d.nodes.filter((n) => op.ids.includes(n.id)).map((n) => (touchFrames.add(n.frameId), { ...n, id: uid("n"), name: `${n.name} copy`, x: n.x + 16, y: n.y + 16, locked: undefined }));
      return finish({ ...d, nodes: [...d.nodes, ...copies] }, `Duplicated ${copies.length} node${copies.length === 1 ? "" : "s"}`, null, copies.map((c) => c.id));
    }
    case "ORDER": {
      const sel = d.nodes.filter((n) => op.ids.includes(n.id));
      if (!sel.length) return { doc: d, summary: "" };
      sel.forEach((n) => touchFrames.add(n.frameId));
      let nodes = [...d.nodes];
      if (op.to === "front") nodes = [...nodes.filter((n) => !op.ids.includes(n.id)), ...sel];
      else if (op.to === "back") nodes = [...sel, ...nodes.filter((n) => !op.ids.includes(n.id))];
      else {
        const step = op.to === "up" ? 1 : -1;
        const order = op.to === "up" ? [...sel].reverse() : sel;
        order.forEach((n) => {
          const i = nodes.findIndex((x) => x.id === n.id);
          let j = i + step;
          while (j >= 0 && j < nodes.length && nodes[j]?.frameId !== n.frameId) j += step;
          const other = nodes[j];
          if (other && !op.ids.includes(other.id)) { nodes.splice(i, 1); nodes.splice(j, 0, n); }
        });
      }
      return finish({ ...d, nodes }, `Layer order: ${op.to === "front" ? "to front" : op.to === "back" ? "to back" : op.to === "up" ? "forward" : "backward"}`, null, op.ids, undefined, false);
    }
    case "LOCK": {
      return finish({ ...d, nodes: d.nodes.map((n) => (op.ids.includes(n.id) ? { ...n, locked: op.locked || undefined } : n)) }, `${op.locked ? "Locked" : "Unlocked"} ${op.ids.length} node${op.ids.length === 1 ? "" : "s"}`, null, op.ids, undefined, false);
    }
    case "GROUP": {
      const lk = locked(d, op.ids); if (lk.length) return refuse(lk);
      return finish({ ...d, nodes: d.nodes.map((n) => (op.ids.includes(n.id) ? { ...n, group: op.group } : n)) }, op.group ? `Grouped ${op.ids.length} nodes` : "Ungrouped", null, op.ids, undefined, false);
    }
    case "ALIGN": {
      const sel = d.nodes.filter((n) => op.ids.includes(n.id));
      const lk = sel.filter((n) => n.locked).map((n) => n.name); if (lk.length) return refuse(lk);
      if (!sel.length) return { doc: d, summary: "" };
      const frame = d.frames.find((f) => f.id === sel[0]?.frameId);
      const box = sel.length > 1 ? { l: Math.min(...sel.map((n) => n.x)), t: Math.min(...sel.map((n) => n.y)), r: Math.max(...sel.map((n) => n.x + n.w)), b: Math.max(...sel.map((n) => n.y + n.h)) } : { l: 0, t: 0, r: frame?.w ?? 0, b: frame?.h ?? 0 };
      const nodes = d.nodes.map((n) => {
        if (!op.ids.includes(n.id)) return n;
        touchFrames.add(n.frameId);
        const m = op.mode;
        return { ...n, x: m === "left" ? box.l : m === "right" ? box.r - n.w : m === "center" ? Math.round((box.l + box.r) / 2 - n.w / 2) : n.x, y: m === "top" ? box.t : m === "bottom" ? box.b - n.h : m === "middle" ? Math.round((box.t + box.b) / 2 - n.h / 2) : n.y };
      });
      return finish({ ...d, nodes }, `Aligned ${op.mode}`, null, op.ids);
    }
    case "DISTRIBUTE": {
      const sel = d.nodes.filter((n) => op.ids.includes(n.id)).sort((a, b) => (op.axis === "x" ? a.x - b.x : a.y - b.y));
      if (sel.length < 3) return { doc: d, summary: "" };
      const lk = sel.filter((n) => n.locked).map((n) => n.name); if (lk.length) return refuse(lk);
      const first = sel[0]!, last = sel[sel.length - 1]!;
      const size = (n: SNode) => (op.axis === "x" ? n.w : n.h);
      const total = (op.axis === "x" ? last.x + last.w - first.x : last.y + last.h - first.y) - sel.reduce((a, n) => a + size(n), 0);
      const gap = total / (sel.length - 1);
      let cursor = op.axis === "x" ? first.x : first.y;
      const pos = new Map<string, number>();
      sel.forEach((n) => { pos.set(n.id, Math.round(cursor)); cursor += size(n) + gap; });
      const nodes = d.nodes.map((n) => (pos.has(n.id) ? (touchFrames.add(n.frameId), op.axis === "x" ? { ...n, x: pos.get(n.id)! } : { ...n, y: pos.get(n.id)! }) : n));
      return finish({ ...d, nodes }, `Distributed ${sel.length} nodes ${op.axis === "x" ? "horizontally" : "vertically"}`, null, op.ids);
    }
    case "TOKEN": {
      const territories = d.territories.map((t) => (t.id === op.territoryId ? { ...t, tokens: op.apply(t.tokens) } : t));
      d.frames.filter((f) => f.territoryId === op.territoryId).forEach((f) => touchFrames.add(f.id));
      return finish({ ...d, territories }, op.label, "TOKENS", [op.territoryId]);
    }
    case "GENOME": {
      const territories = d.territories.map((t) => (t.id === op.territoryId ? { ...t, genome: { ...t.genome, [op.key]: { ...t.genome[op.key], ...op.patch } } } : t));
      return finish({ ...d, territories }, `Genome: ${op.key} updated`, "GENOME", [op.territoryId], undefined, false);
    }
    case "SELECT_TERRITORY": {
      const target = d.territories.find((t) => t.id === op.id);
      if (!target) return { doc: d, summary: "" };
      // The chosen direction is selected and the others are set aside (kept, not deleted: any of them can be chosen again).
      const territories = d.territories.map((t) => ({ ...t, status: t.id === op.id ? ("SELECTED" as const) : ("SET_ASIDE" as const) }));
      return finish({ ...d, territories, selectedTerritoryId: op.id }, `Chose ${target.name} (${target.posture.toLowerCase()})`, "TERRITORY", [op.id], op.rationale, false);
    }
    case "FRAME_VARIANT": {
      const src = d.frames.find((f) => f.id === op.frameId);
      if (!src) return { doc: d, summary: "" };
      const nf: Frame = { ...src, id: uid("frame"), name: `${src.name} (variant)` };
      const copies = nodesOf(d, src.id).map((n) => ({ ...n, id: uid("n"), frameId: nf.id, locked: undefined }));
      return finish({ ...d, frames: [...d.frames, nf], nodes: [...d.nodes, ...copies] }, `Duplicated ${src.name} as a variant`, null, [nf.id], undefined, false);
    }
    case "ANNOTATE": return finish({ ...d, annotations: [...d.annotations, op.note] }, "Added a note", null, [op.note.id], undefined, false);
    case "NOTE_EDIT": return finish({ ...d, annotations: d.annotations.map((a) => (a.id === op.id ? { ...a, ...op.patch } : a)) }, op.patch.resolved !== undefined ? (op.patch.resolved ? "Resolved a note" : "Reopened a note") : "Edited a note", null, [op.id], undefined, false);
    case "NOTE_DELETE": return finish({ ...d, annotations: d.annotations.filter((a) => a.id !== op.id) }, "Deleted a note", null, [op.id], undefined, false);
    case "DECIDE": return finish(d, op.summary, "NOTE", [], op.rationale, false);
    case "APPROVE": {
      const frames = op.frameIds.filter((id) => d.frames.some((f) => f.id === id));
      if (!frames.length) return { doc: d, summary: "" };
      const approval = { id: uid("apr"), revision: nextRev, frameIds: frames, by, at: new Date().toISOString(), stale: false };
      // approving a frame supersedes any earlier approval of the same frame
      const approvals = [...d.approvals.map((a) => (a.frameIds.every((f) => frames.includes(f)) && !a.stale ? { ...a, stale: true, staleReason: `Superseded by r${nextRev}` } : a)), approval];
      return finish({ ...d, approvals }, `Approved ${frames.map((f) => describeFrame(d, f)).join(", ")} at r${nextRev}`, "APPROVAL", frames, undefined, false);
    }
    case "PROPOSAL": {
      if (!op.accepted) return finish(d, `Set aside the proposal: ${op.label}`, "PROPOSAL", [], op.rationale, false);
      const ids = op.patches.map((p) => p.id);
      const lk = locked(d, ids); if (lk.length) return refuse(lk);
      const byId = new Map(op.patches.map((p) => [p.id, p.patch]));
      const nodes = d.nodes.map((n) => {
        const patch = byId.get(n.id); if (!patch) return n;
        touchFrames.add(n.frameId);
        const { text, ...rest } = patch;
        const next: SNode = { ...n, ...rest };
        if (text && n.text) next.text = { ...n.text, ...text };
        return next;
      });
      return finish({ ...d, nodes }, `Accepted the proposal: ${op.label}`, "PROPOSAL", ids, op.rationale);
    }
    case "RESTORE": {
      const snap = JSON.parse(op.snapshot) as Pick<DesignDocument, "territories" | "selectedTerritoryId" | "frames" | "nodes" | "annotations">;
      snap.frames.forEach((f) => touchFrames.add(f.id));
      d.frames.forEach((f) => touchFrames.add(f.id));
      return finish({ ...d, ...snap }, `Restored ${op.name}`, "RESTORE", [], undefined);
    }
    case "IMPORT": return finish({ ...op.doc, revision: nextRev, revisions: [...(op.doc.revisions ?? []), { n: nextRev, at: new Date().toISOString(), by, summary: "Imported a design document" }].slice(-200) }, "Imported a design document", "IMPORT", [], undefined, false);
  }
}

export const ZERO: Paint = { hex: "#000000" };
export const sameIds = same;
export const radiusLabel: Record<Radius, string> = { none: "Square", sm: "Small", md: "Medium", lg: "Large", full: "Round" };
export const tokensOfNode = (d: DesignDocument, n: SNode) => frameTokens(d, n.frameId);
