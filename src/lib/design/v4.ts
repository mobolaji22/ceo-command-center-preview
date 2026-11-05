import type { SddDocument } from "./sdd.generated";
import schema from "./sdd-document.schema.json";

/**
 * v4's design document (dev-playbook-v4 ADR-0049 decision 5, ADR-0051), as the Workshop reads and draws it. The document's shape is
 * v4's: its types are generated from the schema v4 publishes (`npm run v4:types`), and this file only names their parts and reads
 * them. Nothing here decides anything: choosing a direction, saving, annotating and approving are calls to v4, which decides who may.
 */
export type { SddDocument };
export type SddTerritory = SddDocument["territories"][number];
export type SddNode = SddDocument["nodes"][number];
export type SddFrame = SddDocument["frames"][number];
export type SddAnnotation = SddDocument["annotations"][number];
export type SddTokens = NonNullable<SddDocument["tokens"]>;
export type SddText = NonNullable<SddNode["text"]>;
/** A colour: one of the direction's colour tokens, or a value of its own. */
export type SddPaint = SddText["colour"];
/** What fills a node in version 4: a colour, a gradient of colours, or a media slot's image (dev-playbook-v4 ADR-0057 Decision 4). */
export type SddFill = NonNullable<SddNode["style"]["fill"]>;
export type SddStyle = SddNode["style"];
export type SddMotion = SddNode["motion"][number];
export type SddMediaSlot = SddDocument["mediaSlots"][number];
export type SddScene = NonNullable<SddNode["scene"]>;
export type SddBox = NonNullable<SddNode["geometry"]["box"]>;
export type SddTypeStyle = NonNullable<SddTokens["type"][string]>;
export type FontFamily = SddTypeStyle["family"];
export type AnnotationKind = SddAnnotation["kind"];
export type AnnotationTarget = SddAnnotation["target"];

/** The kinds of feedback, read from v4's published schema: the one list is v4's, so a kind it adds appears here without a second list. */
export const ANNOTATION_KINDS = schema.properties.annotations.items.properties.kind.enum as readonly AnnotationKind[];
export const KIND_WORDS: Record<AnnotationKind, string> = { FEEDBACK: "Feedback", CHANGE_REQUEST: "Change request", ACCESSIBILITY: "Accessibility", ENGINEERING_QUESTION: "Engineering question" };
export const STATUS_WORDS: Record<SddAnnotation["status"], string> = { OPEN: "Open", ADDRESSED: "Addressed", DECLINED: "Declined" };

/** What v4's `GET /v1/projects/:id/sdd` answers. */
export type SddView = {
  /** The approved revision, if one is. */
  approved: { version: number; revision: number; approvedAt: string; document: SddDocument } | null;
  /** The revision being edited or decided, where the reader may see it: the agency always, a client once it is submitted. */
  current: { proposalId: string; status: "DRAFT" | "SUBMITTED"; baseVersion: number | null; documentHash: string; document: SddDocument } | null;
  /** The feedback on the revision being worked on and what became of it, which a client sees even while the draft is the agency's. */
  annotations: SddAnnotation[];
};

/** One approved version, as `GET .../sdd/versions` lists it, newest first. */
export type SddVersion = { version: number; approvedAt: string; approvedById: string };

/** A key frame as v4 assembles it from territory exploration: which territory, which viewport, its root and its nodes. */
export type StudyFrame = { id: string; territoryId: string; viewport: string; rootNodeId: string | null; nodeIds: string[] };

/** A slot for Content's words on a node: what it is for and how long it may be. The words themselves are Content's, never the canvas's. */
export type ContentSlot = { key: string; purpose: string; maxChars: number | null; status: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** The document a person is looking at: the one in progress if there is one, else the approved one. */
export const documentOf = (view: SddView | null | undefined): SddDocument | null => view?.current?.document ?? view?.approved?.document ?? null;

/** A territory's key frames, in the order v4 lists them. */
export function framesOf(doc: SddDocument, territoryId: string): StudyFrame[] {
  return doc.frames.flatMap((f) => (f.territoryId === territoryId ? [{ id: f.id, territoryId, viewport: f.viewport ?? "", rootNodeId: f.rootNodeId, nodeIds: f.nodeIds }] : []));
}

/** The node's Content slot, if it has one. */
export function slotOf(node: SddNode): ContentSlot | null {
  const ref = isRecord(node.content) ? node.content["contentRef"] : null;
  if (!isRecord(ref)) return null;
  return { key: str(ref["key"]), purpose: str(ref["purpose"]), maxChars: typeof ref["maxChars"] === "number" ? ref["maxChars"] : null, status: str(ref["status"]) };
}

/** How the node is laid out, in the words territory exploration gave; the box the layout pass set from them is in its geometry. */
export const layoutOf = (node: SddNode): string => node.geometry.intent ?? "";

/** A frame's nodes as a tree, from its root, following each node's parent. A node whose parent is missing is not drawn twice. */
export type NodeTree = { node: SddNode; children: NodeTree[] };
export function treeOf(doc: SddDocument, frame: StudyFrame): NodeTree | null {
  const inFrame = new Set(frame.nodeIds);
  const nodes = doc.nodes.filter((n) => inFrame.has(n.id));
  const root = nodes.find((n) => n.id === frame.rootNodeId) ?? nodes.find((n) => n.parentId === null);
  if (!root) return null;
  const seen = new Set<string>();
  const grow = (node: SddNode): NodeTree => {
    seen.add(node.id);
    return { node, children: nodes.filter((n) => n.parentId === node.id && !seen.has(n.id)).map(grow) };
  };
  return grow(root);
}

/** The direction is still to be chosen: the territories are there and none is selected. */
export const choosing = (doc: SddDocument | null): boolean => !!doc && doc.territories.length > 0 && doc.selectedTerritoryId === null;

export const POSTURE_WORDS: Record<string, string> = { CONSERVATIVE: "Conservative", DISTINCTIVE: "Distinctive", EXPERIMENTAL: "Experimental" };

/** A territory's tokens, one line each, for reading out. */
export function tokenLines(t: SddTerritory): Array<{ group: string; name: string; value: string }> {
  const k = t.tokens;
  if (!k) return [];
  const line = <V,>(group: string, rec: Record<string, V | undefined>, say: (v: V) => string) => Object.entries(rec).flatMap(([name, v]) => (v === undefined ? [] : [{ group, name, value: say(v) }]));
  return [
    ...line("colour", k.colour, (v) => v),
    ...line("type", k.type, (v) => `${v.family} ${v.size}px, weight ${v.weight}`),
    ...line("space", k.space, (v) => `${v}px`),
    ...line("radius", k.radius, (v) => `${v}px`),
  ];
}

/* ---- drawing: what a node looks like, from its style and the tokens of its frame ------------------------------------------- */

/** The tokens a frame is drawn with: its territory's, or the document's for a frame of no territory. */
export function tokensOf(doc: SddDocument, frame: SddFrame | undefined): SddTokens | null {
  const own = frame?.territoryId ? doc.territories.find((t) => t.id === frame.territoryId)?.tokens : null;
  return own ?? doc.tokens ?? null;
}

/** The frame a node belongs to. */
export const frameOfNode = (doc: SddDocument, nodeId: string): SddFrame | undefined => doc.frames.find((f) => f.nodeIds.includes(nodeId));

/** A frame's nodes in drawing order: a parent before its children, siblings in their parent's order. */
export function nodesOf(doc: SddDocument, frame: SddFrame): SddNode[] {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const inFrame = new Set(frame.nodeIds);
  const out: SddNode[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    const n = byId.get(id);
    if (!n || seen.has(id) || !inFrame.has(id)) return;
    seen.add(id); out.push(n); n.children.forEach(walk);
  };
  if (frame.rootNodeId) walk(frame.rootNodeId);
  frame.nodeIds.forEach(walk);
  return out;
}

/** A node and everything inside it. */
export function subtreeOf(doc: SddDocument, id: string): string[] {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const out: string[] = [];
  const walk = (x: string) => { if (out.includes(x)) return; const n = byId.get(x); if (!n) return; out.push(x); n.children.forEach(walk); };
  walk(id);
  return out;
}

export const FONT_STACK: Record<FontFamily, string> = {
  serif: '"Cormorant Garamond", Georgia, "Times New Roman", serif',
  sans: '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  grotesk: '"Helvetica Neue", Arial, system-ui, sans-serif',
};

export const paintHex = (p: SddPaint | null | undefined, t: SddTokens, fallback = "transparent"): string => (!p ? fallback : "token" in p ? (t.colour[p.token] ?? fallback) : p.hex);

/** A fill as a colour, where one colour must stand for it (contrast, a swatch): a gradient's first stop; an image has none. */
export const fillHex = (f: SddFill | null | undefined, t: SddTokens, fallback = "transparent"): string =>
  !f ? fallback : "linear" in f ? paintHex(f.linear.stops[0].colour, t, fallback) : "radial" in f ? paintHex(f.radial.stops[0].colour, t, fallback) : "image" in f ? fallback : paintHex(f, t, fallback);

/** Whether a fill is a plain colour, which the Workshop edits; a gradient or an image is the direction's, shown as it is. */
export const isColourFill = (f: SddFill | null): f is SddPaint | null => !f || "token" in f || "hex" in f;

/** A fill as CSS, drawn as v4's renderer draws it: gradients from their stops, an image slot as a labelled hatch until it is held. */
export function fillCss(f: SddFill | null | undefined, t: SddTokens): string {
  if (!f) return "transparent";
  const stops = (ss: ReadonlyArray<{ colour: SddPaint; at: number }>) => ss.map((x) => `${paintHex(x.colour, t, "#000000")} ${Math.round(x.at * 100)}%`).join(", ");
  if ("linear" in f) return `linear-gradient(${f.linear.angle}deg, ${stops(f.linear.stops)})`;
  if ("radial" in f) return `radial-gradient(circle at ${Math.round(f.radial.x * 100)}% ${Math.round(f.radial.y * 100)}%, ${stops(f.radial.stops)})`;
  if ("image" in f) return `repeating-linear-gradient(135deg, transparent 0 14px, ${t.colour.text ?? "#000000"}22 14px 15px)`;
  return paintHex(f, t);
}

/** Shadows, blur, blend, rotation and scale as CSS. */
export function effectsCss(s: SddStyle, t: SddTokens): { boxShadow?: string; filter?: string; mixBlendMode?: SddStyle["blend"]; transform?: string } {
  const alpha = (o: number) => Math.round(Math.max(0, Math.min(1, o)) * 255).toString(16).padStart(2, "0");
  const shadow = s.shadows.map((x) => `${x.x}px ${x.y}px ${x.blur}px ${x.spread}px ${paintHex(x.colour, t, "#000000")}${alpha(x.opacity)}`).join(", ");
  const moves = [s.rotate ? `rotate(${s.rotate}deg)` : "", s.scale !== 1 ? `scale(${s.scale})` : ""].filter(Boolean).join(" ");
  return { ...(shadow ? { boxShadow: shadow } : {}), ...(s.blur ? { filter: `blur(${s.blur}px)` } : {}), ...(s.blend !== "normal" ? { mixBlendMode: s.blend } : {}), ...(moves ? { transform: moves } : {}) };
}

/** The font a type token sets: its named typeface first, then its class, so a page shows the typeface where it is installed. */
export const fontOf = (type: SddTypeStyle): string => (type.typeface ? `${JSON.stringify(type.typeface)}, ${FONT_STACK[type.family]}` : FONT_STACK[type.family]);

/** How a media slot's material is to be had, as a person reads it. */
export const SOURCE_WORDS: Record<SddMediaSlot["source"], string> = {
  HELD: "held", CAPTURE: "to be captured", ASK: "requested from the client", DERIVE: "derived by the agency", DRAW: "drawn by the agency", DRAFT: "drafted by the agency", SOURCE_EXTERNAL: "to be sourced",
};
export const MEDIA_WORDS: Record<SddMediaSlot["kind"], string> = { photograph: "Photograph", illustration: "Illustration", video: "Video", "model-3d": "3D model", icon: "Icon" };
/** A media slot in one line: "Photograph: the roaster at the drum (21:9), requested from the client". */
export const mediaLine = (m: SddMediaSlot): string => `${MEDIA_WORDS[m.kind]}: ${m.subject}${m.ratio ? ` (${m.ratio})` : ""}, ${m.assetRef ? "held" : SOURCE_WORDS[m.source]}`;
/** The media slot a node shows, by its own reference or its image fill. */
export function mediaOf(doc: SddDocument, n: SddNode): SddMediaSlot | null {
  const id = n.mediaSlotRef ?? (n.style.fill && "image" in n.style.fill ? n.style.fill.image.slot : null);
  return id ? (doc.mediaSlots.find((m) => m.id === id) ?? null) : null;
}

/** A motion in words: when it starts, what it does, how long, and what a person who asked for less motion sees instead. */
export function motionLine(m: SddMotion, t: SddTokens): string {
  const when = { load: "On load", "enter-view": "As it comes into view", scroll: "With the scroll", hover: "On hover", press: "On press" }[m.trigger];
  const ms = "token" in m.timing ? (t.motion[m.timing.token]?.durationMs ?? null) : m.timing.durationMs;
  const first = m.keyframes[0];
  const does = [first.opacity !== undefined ? "fades" : "", first.y || first.x ? "moves" : "", first.scale !== undefined ? "scales" : "", first.rotate !== undefined ? "turns" : ""].filter(Boolean).join(", ") || "moves";
  const reduced = { static: "nothing moves", fade: "a short fade", shorter: "a shorter version" }[m.reducedMotion];
  return `${when}, it ${does}${ms ? ` over ${ms}ms` : ""}; with reduced motion, ${reduced}.`;
}

/** A radius token in pixels; `full` is a pill. */
export function radiusPx(name: string | null, t: SddTokens, box: SddBox): number {
  if (!name) return 0;
  const half = Math.min(box.w, box.h) / 2;
  return name === "full" ? half : Math.min(t.radius[name] ?? 0, half);
}

/** The type token a node's words are set in, or the first one the tokens hold. */
export const typeStyleOf = (t: SddTokens, name: string): SddTypeStyle | null => t.type[name] ?? Object.values(t.type).find((v) => v !== undefined) ?? null;

/** The colour a node's words sit on: its own fill, else the nearest filled ancestor's, else the frame's surface. */
export function surfaceUnder(doc: SddDocument, node: SddNode, t: SddTokens): string {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  for (let n: SddNode | undefined = node; n; n = n.parentId ? byId.get(n.parentId) : undefined) if (n.style.fill) return fillHex(n.style.fill, t, t.colour.surface);
  return t.colour.surface;
}

/* ---- contrast (WCAG 2.x relative luminance), shown beside a colour so a person sees what a change does to reading --------- */
function lin(c: number) { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const v = parseInt(m[1]!, 16);
  return 0.2126 * lin((v >> 16) & 255) + 0.7152 * lin((v >> 8) & 255) + 0.0722 * lin(v & 255);
}
export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
export const wcagLabel = (ratio: number, large = false) => (ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 && large ? "AA large" : ratio >= 3 ? "Large text only" : "Fails");
/** Text is "large" at 24px, or 18.66px and bold, which relaxes the AA threshold to 3:1. */
export const isLargeText = (size: number, weight: number) => size >= 24 || (size >= 18.66 && weight >= 700);
