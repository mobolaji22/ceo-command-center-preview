/**
 * The structured design document (SDD), the "lite" subset the Design Workshop edits (Design Intelligence Contract v15, §5).
 * It is the source of truth: the canvas only draws it. Nothing here is HTML, CSS or a framework component; colours and type are
 * semantic roles (tokens) that nodes refer to, so changing a token changes every node that uses it.
 */
export const SDD_SCHEMA = "sdd/1-lite";

export type Posture = "CONSERVATIVE" | "DISTINCTIVE" | "EXPERIMENTAL";
export type ColorRole = "surface" | "surfaceAlt" | "text" | "textMuted" | "accent" | "accentText" | "border" | "focus";
export type TypeRole = "display" | "heading" | "body" | "label";
export type FontFamily = "serif" | "sans" | "mono" | "grotesk";

export type TypeStyle = { family: FontFamily; size: number; weight: number; tracking: number; lineHeight: number };
export type Tokens = {
  color: Record<ColorRole, string>;
  type: Record<TypeRole, TypeStyle>;
  radius: { sm: number; md: number; lg: number };
  space: { base: number };
  motion: { durationMs: number; easing: "ease-out" | "ease-in-out" | "linear" };
};

export const GENOME_KEYS = ["composition", "typography", "imagePhilosophy", "spatialBehaviour", "density", "shapeLanguage", "colourBehaviour", "motionLanguage", "interactionLanguage", "textureMaterial", "visualMetaphor", "signatureDevice"] as const;
export type GenomeKey = (typeof GENOME_KEYS)[number];
export const GENOME_LABEL: Record<GenomeKey, string> = {
  composition: "Composition", typography: "Typography", imagePhilosophy: "Image philosophy", spatialBehaviour: "Spatial behaviour", density: "Density", shapeLanguage: "Shape language",
  colourBehaviour: "Colour behaviour", motionLanguage: "Motion language", interactionLanguage: "Interaction language", textureMaterial: "Texture and material", visualMetaphor: "Visual metaphor", signatureDevice: "Signature device",
};
export type GenomeEntry = { decision: string; rationale: string; confidence: "high" | "medium" | "low" };

export type Paint = { token: ColorRole } | { hex: string };
export type Radius = "none" | "sm" | "md" | "lg" | "full";
export type NodeKind = "rect" | "text" | "button" | "image" | "line";
/** `size` overrides the type style's size for this element only (a headline set smaller on a phone). Everything else follows the style. */
export type TextSpec = { content: string; style: TypeRole; color: Paint; align: "left" | "center" | "right"; size?: number | undefined };

export type SNode = {
  id: string;
  frameId: string;
  kind: NodeKind;
  /** What the node is for (headline, primary action, product card...), apart from what it is called on screen. */
  role: string;
  name: string;
  x: number; y: number; w: number; h: number;
  fill?: Paint | undefined;
  stroke?: Paint | undefined;
  radius?: Radius | undefined;
  opacity?: number | undefined;
  text?: TextSpec | undefined;
  /** An image node stands for an asset. Until a real one is attached it is a placeholder that cannot be mistaken for a final. */
  asset?: { label: string; status: "placeholder" | "supplied" } | undefined;
  locked?: boolean | undefined;
  hidden?: boolean | undefined;
  group?: string | undefined;
};

export type Frame = { id: string; territoryId: string; name: string; viewport: "desktop" | "tablet" | "mobile"; w: number; h: number };

export type Territory = {
  id: string;
  posture: Posture;
  name: string;
  thesis: string;
  technique: string;
  signature: string;
  strengths: string[];
  risks: string[];
  status: "PROPOSED" | "SELECTED" | "SET_ASIDE";
  tokens: Tokens;
  genome: Record<GenomeKey, GenomeEntry>;
};

export type Annotation = { id: string; frameId: string; nodeId: string | null; x: number; y: number; text: string; by: string; at: string; resolved: boolean };
export type DecisionKind = "TERRITORY" | "EDIT" | "TOKENS" | "GENOME" | "PROPOSAL" | "APPROVAL" | "RESTORE" | "NOTE" | "IMPORT";
export type Decision = { id: string; at: string; by: string; kind: DecisionKind; summary: string; rationale?: string | undefined; affected: string[] };
export type Approval = { id: string; revision: number; frameIds: string[]; by: string; at: string; stale: boolean; staleReason?: string | undefined };
export type RevisionEntry = { n: number; at: string; by: string; summary: string };
export type Checkpoint = { id: string; name: string; at: string; by: string; revision: number; snapshot: string };

export type DesignDocument = {
  schemaVersion: typeof SDD_SCHEMA;
  documentId: string;
  projectId: string;
  projectName: string;
  revision: number;
  status: "DRAFT" | "IN_REVIEW";
  mandate: { objective: string; audience: string; constraints: string[]; nonGoals: string[] };
  meaningModel: { meaning: string; perception: string };
  territories: Territory[];
  selectedTerritoryId: string | null;
  frames: Frame[];
  nodes: SNode[];
  annotations: Annotation[];
  decisionLog: Decision[];
  approvals: Approval[];
  revisions: RevisionEntry[];
  checkpoints: Checkpoint[];
  provenance: { createdBy: string; createdAt: string; generator: string; note: string };
};

/* ---- resolving tokens ------------------------------------------------------------------------------------ */
export const FONT_STACK: Record<FontFamily, string> = {
  serif: '"Cormorant Garamond", Georgia, "Times New Roman", serif',
  sans: '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  grotesk: 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
};
export const FONT_LABEL: Record<FontFamily, string> = { serif: "Serif (Cormorant)", sans: "Sans (DM Sans)", mono: "Monospace", grotesk: "Grotesk (system)" };

export const paintHex = (p: Paint | undefined, t: Tokens, fallback = "transparent"): string => (!p ? fallback : "token" in p ? t.color[p.token] : p.hex);
export const radiusPx = (r: Radius | undefined, t: Tokens, w: number, h: number): number => (r === "sm" ? t.radius.sm : r === "md" ? t.radius.md : r === "lg" ? t.radius.lg : r === "full" ? Math.min(w, h) / 2 : 0);

export const territoryOf = (d: DesignDocument, id: string | null) => d.territories.find((t) => t.id === id) ?? null;
export const frameTokens = (d: DesignDocument, frameId: string): Tokens | null => {
  const f = d.frames.find((x) => x.id === frameId);
  return f ? territoryOf(d, f.territoryId)?.tokens ?? null : null;
};
export const nodesOf = (d: DesignDocument, frameId: string) => d.nodes.filter((n) => n.frameId === frameId);

/* ---- contrast (WCAG 2.x relative luminance) ------------------------------------------------------------- */
export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1] ?? "";
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export const toHex = ([r, g, b]: [number, number, number]) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export function luminance(hex: string): number {
  const c = parseHex(hex);
  return c ? 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]) : 0;
}
export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** The colour a text node sits on: the top-most filled node under its centre, else the frame's surface. */
export function surfaceUnder(d: DesignDocument, node: SNode): string {
  const t = frameTokens(d, node.frameId);
  if (!t) return "#ffffff";
  const cx = node.x + node.w / 2, cy = node.y + node.h / 2;
  const under = nodesOf(d, node.frameId).filter((n) => n.id !== node.id && !n.hidden && n.fill && (n.kind === "rect" || n.kind === "button") && cx >= n.x && cx <= n.x + n.w && cy >= n.y && cy <= n.y + n.h && d.nodes.indexOf(n) < d.nodes.indexOf(node));
  const top = under[under.length - 1];
  return top ? paintHex(top.fill, t) : t.color.surface;
}
export const wcagLabel = (ratio: number, large = false) => (ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 && large ? "AA large" : ratio >= 3 ? "Large text only" : "Fails");
/** Text is "large" at 24px, or 18.66px and bold, which relaxes the AA threshold to 3:1. */
export const isLargeText = (size: number, weight: number) => size >= 24 || (size >= 18.66 && weight >= 700);

/* ---- validation (what must hold before a revision can be approved) --------------------------------------- */
export function validate(d: DesignDocument): string[] {
  const issues: string[] = [];
  const frameIds = new Set(d.frames.map((f) => f.id));
  const terr = new Set(d.territories.map((t) => t.id));
  if (d.schemaVersion !== SDD_SCHEMA) issues.push(`Unknown schema ${String(d.schemaVersion)}.`);
  if (d.territories.length !== 3) issues.push("A design needs exactly three territories.");
  if (d.selectedTerritoryId && !terr.has(d.selectedTerritoryId)) issues.push("The selected territory does not exist.");
  d.frames.forEach((f) => { if (!terr.has(f.territoryId)) issues.push(`Frame ${f.name} belongs to a missing territory.`); });
  const ids = new Set<string>();
  d.nodes.forEach((n) => {
    if (ids.has(n.id)) issues.push(`Duplicate node id ${n.id}.`);
    ids.add(n.id);
    if (!frameIds.has(n.frameId)) issues.push(`Node ${n.name} is on a missing frame.`);
    if (n.kind === "text" && !n.text) issues.push(`Text node ${n.name} has no text.`);
    if (n.kind === "image" && n.asset?.status === "placeholder") issues.push(`${n.name} is still a placeholder asset.`);
  });
  return issues;
}
