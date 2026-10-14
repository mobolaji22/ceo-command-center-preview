import { contrast, frameTokens, isLargeText, paintHex, parseHex, surfaceUnder, toHex, type DesignDocument, type SNode } from "./sdd";
import type { NodePatch } from "./ops";

/**
 * Proposals: changes the system suggests, shown before and after, and never applied until a person accepts them. They work only
 * on what is in scope and never touch a locked node. This fixture provider uses fixed rules so the governance around proposals
 * (scope, protection, before/after, attribution) can be built and tested before a design model is connected; a model-backed
 * provider implements the same interface.
 */
export type ProposalKind = "contrast" | "grid";
export type ProposalChange = { id: string; name: string; patch: NodePatch; detail: string };
export type Proposal = { kind: ProposalKind; label: string; description: string; rationale: string; changes: ProposalChange[]; skipped: { name: string; reason: string }[]; after: DesignDocument };
export interface ProposalProvider { propose(kind: ProposalKind, doc: DesignDocument, scope: { frameId: string; ids?: string[] }): Promise<Proposal | null> }

export function applyPatches(doc: DesignDocument, changes: { id: string; patch: NodePatch }[]): DesignDocument {
  const by = new Map(changes.map((c) => [c.id, c.patch]));
  return {
    ...doc,
    nodes: doc.nodes.map((n) => {
      const p = by.get(n.id); if (!p) return n;
      const { text, ...rest } = p;
      const next: SNode = { ...n, ...rest };
      if (text && n.text) next.text = { ...n.text, ...text };
      return next;
    }),
  };
}

const backgroundOf = (d: DesignDocument, n: SNode, t: NonNullable<ReturnType<typeof frameTokens>>) => (n.kind === "button" ? paintHex(n.fill, t, t.color.surface) : surfaceUnder(d, n));

/** Move a colour toward black or white, whichever reaches the target contrast in fewer steps. */
function nudge(color: string, against: string, target: number): string | null {
  const rgb = parseHex(color);
  if (!rgb) return null;
  for (const end of [[0, 0, 0], [255, 255, 255]] as const) {
    for (let i = 1; i <= 20; i++) {
      const k = i / 20;
      const candidate = toHex([rgb[0] + (end[0] - rgb[0]) * k, rgb[1] + (end[1] - rgb[1]) * k, rgb[2] + (end[2] - rgb[2]) * k]);
      if (contrast(candidate, against) >= target) return candidate;
    }
  }
  return null;
}

function inScope(doc: DesignDocument, scope: { frameId: string; ids?: string[] }) {
  return doc.nodes.filter((n) => n.frameId === scope.frameId && !n.hidden && (!scope.ids?.length || scope.ids.includes(n.id)));
}

export const FixtureProposalProvider: ProposalProvider = {
  async propose(kind, doc, scope) {
    const t = frameTokens(doc, scope.frameId);
    if (!t) return null;
    const changes: ProposalChange[] = [];
    const skipped: { name: string; reason: string }[] = [];

    if (kind === "contrast") {
      for (const n of inScope(doc, scope)) {
        if (!n.text) continue;
        const style = t.type[n.text.style];
        const target = isLargeText(n.text.size ?? style.size, style.weight) ? 3 : 4.5;
        const bg = backgroundOf(doc, n, t);
        const fg = paintHex(n.text.color, t);
        const ratio = contrast(fg, bg);
        if (ratio >= target) continue;
        if (n.locked) { skipped.push({ name: n.name, reason: "locked" }); continue; }
        const viaToken = contrast(t.color.text, bg) >= target ? t.color.text : null;
        const fixed = viaToken ?? nudge(fg, bg, target);
        if (!fixed) continue;
        changes.push({ id: n.id, name: n.name, patch: { text: { color: viaToken ? { token: "text" } : { hex: fixed } } }, detail: `${fg.toUpperCase()} to ${fixed.toUpperCase()} on ${bg.toUpperCase()}: contrast ${ratio.toFixed(1)} to ${contrast(fixed, bg).toFixed(1)}${viaToken ? " (uses the text token)" : ""}` });
      }
      if (!changes.length && !skipped.length) return null;
      const after = applyPatches(doc, changes);
      return { kind, label: "Fix low-contrast text", description: "Brings text that is below the contrast minimum up to it, changing as little as possible.", rationale: "Text below WCAG 2.2 AA contrast (4.5:1, or 3:1 for large text) was raised to the minimum.", changes, skipped, after };
    }

    // grid: snap position and size to the spacing base
    const step = Math.max(2, t.space.base);
    const snap = (v: number) => Math.round(v / step) * step;
    for (const n of inScope(doc, scope)) {
      if (n.h < 4 || n.w < 4) continue;
      const patch = { x: snap(n.x), y: snap(n.y), w: Math.max(step, snap(n.w)), h: Math.max(step, snap(n.h)) };
      if (patch.x === n.x && patch.y === n.y && patch.w === n.w && patch.h === n.h) continue;
      if (n.locked) { skipped.push({ name: n.name, reason: "locked" }); continue; }
      changes.push({ id: n.id, name: n.name, patch, detail: `${n.x},${n.y} ${n.w}×${n.h} to ${patch.x},${patch.y} ${patch.w}×${patch.h}` });
    }
    if (!changes.length && !skipped.length) return null;
    return { kind, label: `Snap to the ${step}px grid`, description: `Moves and sizes elements onto the ${step}px spacing rhythm so edges line up.`, rationale: `Positions and sizes were snapped to multiples of ${step}px.`, changes, skipped, after: applyPatches(doc, changes) };
  },
};
