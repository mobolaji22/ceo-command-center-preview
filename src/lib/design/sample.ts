import { GENOME_KEYS, SDD_SCHEMA, type DesignDocument, type Frame, type GenomeEntry, type GenomeKey, type Paint, type Posture, type Radius, type SNode, type Territory, type Tokens, type TypeRole } from "./sdd";

/**
 * The fixture provider's output: a design document with exactly three territories (Conservative, Distinctive, Experimental),
 * each with a desktop and a mobile key frame, tokens and a genome, as the contract's Stage 4 asks. It is placeholder concept work
 * that stands in for what the territory-exploration capability will produce; it exists so the Workshop can be built and tested
 * against the real document shape before any model is paid for. The copy is deliberately generic.
 */
const hex = (h: string): Paint => ({ hex: h });

type NodeInit = Partial<SNode> & Pick<SNode, "x" | "y" | "w" | "h">;
function node(frameId: string, id: string, kind: SNode["kind"], role: string, name: string, p: NodeInit): SNode {
  return { id: `${frameId}-${id}`, frameId, kind, role, name, ...p };
}
const rect = (f: string, id: string, role: string, name: string, p: NodeInit & { fill?: Paint; radius?: Radius }) => node(f, id, "rect", role, name, p);
const text = (f: string, id: string, role: string, content: string, style: TypeRole, color: Paint, p: NodeInit & { align?: "left" | "center" | "right"; size?: number }) => {
  const { align, size, ...rest } = p;
  return node(f, id, "text", role, content.length > 28 ? content.slice(0, 26) + "…" : content, { ...rest, text: { content, style, color, align: align ?? "left", ...(size ? { size } : {}) } });
};
const button = (f: string, id: string, role: string, content: string, fill: Paint, color: Paint, p: NodeInit & { radius?: Radius; stroke?: Paint }) => node(f, id, "button", role, content, { ...p, fill, text: { content, style: "label", color, align: "center" } });
const image = (f: string, id: string, role: string, label: string, p: NodeInit & { radius?: Radius; fill?: Paint }) => node(f, id, "image", role, label, { ...p, asset: { label, status: "placeholder" } });

const gen = (rows: Record<GenomeKey, [string, string, GenomeEntry["confidence"]]>): Record<GenomeKey, GenomeEntry> =>
  Object.fromEntries(GENOME_KEYS.map((k) => [k, { decision: rows[k][0], rationale: rows[k][1], confidence: rows[k][2] }])) as Record<GenomeKey, GenomeEntry>;

/* ------------------------------------------------------------------------------------------------------------- */
const conservative = (): { t: Territory; frames: Frame[]; nodes: SNode[] } => {
  const id = "terr-conservative";
  const tokens: Tokens = {
    color: { surface: "#FAF7F2", surfaceAlt: "#EFE8DC", text: "#1F1B16", textMuted: "#5E564B", accent: "#8A5A1E", accentText: "#FFFFFF", border: "#D9CFBF", focus: "#1F5FBF" },
    type: { display: { family: "serif", size: 60, weight: 500, tracking: -0.5, lineHeight: 1.05 }, heading: { family: "serif", size: 30, weight: 500, tracking: 0, lineHeight: 1.15 }, body: { family: "sans", size: 17, weight: 400, tracking: 0, lineHeight: 1.55 }, label: { family: "sans", size: 12, weight: 600, tracking: 1.2, lineHeight: 1.2 } },
    radius: { sm: 4, md: 8, lg: 14 }, space: { base: 8 }, motion: { durationMs: 200, easing: "ease-out" },
  };
  const d = `${id}-desktop`, m = `${id}-mobile`;
  const frames: Frame[] = [{ id: d, territoryId: id, name: "Home, desktop", viewport: "desktop", w: 1280, h: 800 }, { id: m, territoryId: id, name: "Home, mobile", viewport: "mobile", w: 390, h: 800 }];
  const nodes: SNode[] = [
    rect(d, "navbar", "navigation surface", "Navigation bar", { x: 0, y: 0, w: 1280, h: 72, fill: { token: "surface" } }),
    rect(d, "navrule", "divider", "Navigation rule", { x: 0, y: 71, w: 1280, h: 1, fill: { token: "border" } }),
    text(d, "logo", "brand name", "Northwind", "heading", { token: "text" }, { x: 64, y: 20, w: 240, h: 36 }),
    text(d, "links", "navigation links", "Shop     Our story     Journal     Visit", "label", { token: "textMuted" }, { x: 640, y: 28, w: 420, h: 18 }),
    button(d, "navcta", "navigation action", "Order now", { token: "accent" }, { token: "accentText" }, { x: 1096, y: 16, w: 120, h: 40, radius: "sm" }),
    text(d, "headline", "headline", "Good things, made with care and delivered with ease.", "display", { token: "text" }, { x: 64, y: 144, w: 600, h: 210 }),
    text(d, "sub", "supporting copy", "Everything you need to start, in one calm place. Browse, choose and order in a few steps, with clear prices and no surprises.", "body", { token: "textMuted" }, { x: 64, y: 376, w: 500, h: 96 }),
    button(d, "primary", "primary action", "Start your order", { token: "accent" }, { token: "accentText" }, { x: 64, y: 496, w: 184, h: 52, radius: "sm" }),
    button(d, "secondary", "secondary action", "See how it works", { token: "surface" }, { token: "text" }, { x: 264, y: 496, w: 184, h: 52, radius: "sm", stroke: { token: "border" } }),
    image(d, "hero", "hero image", "Hero photograph: the product in daylight", { x: 704, y: 112, w: 512, h: 456, radius: "lg", fill: { token: "surfaceAlt" } }),
    ...[0, 1, 2].flatMap((i) => [
      rect(d, `card${i}`, "product card", `Card ${i + 1}`, { x: 64 + i * 392, y: 616, w: 368, h: 136, radius: "md", fill: { token: "surfaceAlt" } }),
      text(d, `card${i}t`, "card title", ["The everyday loaf", "Weekend selection", "Gift boxes"][i] ?? "", "heading", { token: "text" }, { x: 88 + i * 392, y: 636, w: 320, h: 34 }),
      text(d, `card${i}b`, "card detail", ["From £4.20, baked each morning", "Seasonal, in small batches", "Wrapped and ready to send"][i] ?? "", "body", { token: "textMuted" }, { x: 88 + i * 392, y: 684, w: 320, h: 48 }),
    ]),
    rect(m, "navbar", "navigation surface", "Navigation bar", { x: 0, y: 0, w: 390, h: 64, fill: { token: "surface" } }),
    text(m, "logo", "brand name", "Northwind", "heading", { token: "text" }, { x: 20, y: 14, w: 200, h: 36 }),
    button(m, "navcta", "navigation action", "Order", { token: "accent" }, { token: "accentText" }, { x: 286, y: 12, w: 84, h: 40, radius: "sm" }),
    text(m, "headline", "headline", "Good things, made with care and delivered with ease.", "display", { token: "text" }, { x: 20, y: 96, w: 350, h: 192, size: 44 }),
    text(m, "sub", "supporting copy", "Browse, choose and order in a few steps, with clear prices.", "body", { token: "textMuted" }, { x: 20, y: 300, w: 350, h: 72 }),
    button(m, "primary", "primary action", "Start your order", { token: "accent" }, { token: "accentText" }, { x: 20, y: 392, w: 350, h: 52, radius: "sm" }),
    image(m, "hero", "hero image", "Hero photograph: the product in daylight", { x: 20, y: 468, w: 350, h: 200, radius: "lg", fill: { token: "surfaceAlt" } }),
    rect(m, "card0", "product card", "Card 1", { x: 20, y: 688, w: 350, h: 92, radius: "md", fill: { token: "surfaceAlt" } }),
    text(m, "card0t", "card title", "The everyday loaf", "heading", { token: "text" }, { x: 36, y: 700, w: 300, h: 34 }),
  ];
  const t: Territory = {
    id, posture: "CONSERVATIVE", name: "Confident Refinement", status: "PROPOSED",
    thesis: "The familiar storefront, made exceptional through hierarchy, restraint and unhurried clarity.",
    technique: "Conventional interpretation, justified: the audience buys on trust and ease, so the category pattern is the right pattern, executed with unusual care.",
    signature: "A single warm accent used only where a decision is being asked of the visitor.",
    strengths: ["Fastest to understand; lowest risk to conversion", "Easy to implement and extend across pages", "Reads well at every size"],
    risks: ["Least memorable of the three", "Depends on photography quality to carry warmth"],
    tokens,
    genome: gen({
      composition: ["Two-column hero over a three-card row", "Mirrors how visitors already scan this category", "high"], typography: ["Serif display over a humanist sans body", "Warmth in headlines, clarity in reading text", "high"],
      imagePhilosophy: ["One large, real photograph per view", "Authenticity matters more than polish here", "medium"], spatialBehaviour: ["Generous, even margins on an 8px rhythm", "Calm pacing supports trust", "high"],
      density: ["Low", "A short path to the first action", "high"], shapeLanguage: ["Soft, small radii", "Approachable without looking childish", "medium"],
      colourBehaviour: ["Warm neutrals; accent reserved for actions", "Makes the next step unmistakable", "high"], motionLanguage: ["Short, ease-out, never decorative", "Feedback only", "medium"],
      interactionLanguage: ["Plain buttons with visible states", "Nothing to learn", "high"], textureMaterial: ["Paper-like flat surfaces", "Keeps the focus on content", "medium"],
      visualMetaphor: ["A well-kept shopfront window", "Familiar and welcoming", "medium"], signatureDevice: ["The single accent for decisions", "Gives the brand a recognisable rule", "medium"],
    }),
  };
  return { t, frames, nodes };
};

const distinctive = (): { t: Territory; frames: Frame[]; nodes: SNode[] } => {
  const id = "terr-distinctive";
  const tokens: Tokens = {
    color: { surface: "#14110F", surfaceAlt: "#231E1A", text: "#F2EBDD", textMuted: "#B9AD98", accent: "#E0A93B", accentText: "#14110F", border: "#3A322B", focus: "#8EC5FF" },
    type: { display: { family: "serif", size: 104, weight: 500, tracking: -2, lineHeight: 0.98 }, heading: { family: "serif", size: 34, weight: 500, tracking: 0, lineHeight: 1.1 }, body: { family: "sans", size: 16, weight: 400, tracking: 0, lineHeight: 1.6 }, label: { family: "sans", size: 11, weight: 700, tracking: 2.2, lineHeight: 1.2 } },
    radius: { sm: 0, md: 2, lg: 6 }, space: { base: 8 }, motion: { durationMs: 420, easing: "ease-in-out" },
  };
  const d = `${id}-desktop`, m = `${id}-mobile`;
  const frames: Frame[] = [{ id: d, territoryId: id, name: "Home, desktop", viewport: "desktop", w: 1280, h: 800 }, { id: m, territoryId: id, name: "Home, mobile", viewport: "mobile", w: 390, h: 800 }];
  const nodes: SNode[] = [
    text(d, "logo", "brand name", "NORTHWIND", "label", { token: "text" }, { x: 64, y: 40, w: 200, h: 16 }),
    text(d, "menu", "navigation", "MENU  +", "label", { token: "accent" }, { x: 1112, y: 40, w: 104, h: 16, align: "right" }),
    text(d, "kicker", "kicker", "No. 01  /  THE EVERYDAY LOAF", "label", { token: "textMuted" }, { x: 64, y: 112, w: 420, h: 16 }),
    text(d, "headline", "headline", "Made slowly. Shown plainly.", "display", { token: "text" }, { x: 64, y: 144, w: 760, h: 240 }),
    text(d, "sub", "supporting copy", "One thing, done properly, every morning. Reserve yours before it is gone.", "body", { token: "textMuted" }, { x: 64, y: 416, w: 400, h: 80 }),
    button(d, "primary", "primary action", "RESERVE A LOAF", { token: "accent" }, { token: "accentText" }, { x: 64, y: 528, w: 216, h: 56, radius: "none" }),
    text(d, "link", "secondary action", "Read the story  →", "body", { token: "text" }, { x: 304, y: 544, w: 220, h: 26 }),
    image(d, "imgA", "feature image", "Feature photograph: the crust, close", { x: 800, y: 152, w: 360, h: 460, radius: "none", fill: { token: "surfaceAlt" } }),
    image(d, "imgB", "supporting image", "Supporting photograph: hands, flour", { x: 928, y: 400, w: 288, h: 340, radius: "none", fill: { token: "surfaceAlt" } }),
    rect(d, "block", "signature device", "Accent block", { x: 720, y: 584, w: 128, h: 128, fill: { token: "accent" } }),
    rect(d, "rule", "divider", "Footer rule", { x: 64, y: 704, w: 560, h: 1, fill: { token: "border" } }),
    text(d, "foot", "footer note", "BAKED 05:00 DAILY   —   COLLECTION FROM 08:00", "label", { token: "textMuted" }, { x: 64, y: 720, w: 560, h: 16 }),
    text(m, "logo", "brand name", "NORTHWIND", "label", { token: "text" }, { x: 20, y: 28, w: 180, h: 16 }),
    text(m, "menu", "navigation", "MENU  +", "label", { token: "accent" }, { x: 270, y: 28, w: 100, h: 16, align: "right" }),
    text(m, "headline", "headline", "Made slowly. Shown plainly.", "display", { token: "text" }, { x: 20, y: 88, w: 350, h: 256, size: 64 }),
    image(m, "imgA", "feature image", "Feature photograph: the crust, close", { x: 20, y: 360, w: 350, h: 220, radius: "none", fill: { token: "surfaceAlt" } }),
    rect(m, "block", "signature device", "Accent block", { x: 286, y: 548, w: 84, h: 84, fill: { token: "accent" } }),
    button(m, "primary", "primary action", "RESERVE A LOAF", { token: "accent" }, { token: "accentText" }, { x: 20, y: 664, w: 350, h: 56, radius: "none" }),
    text(m, "foot", "footer note", "BAKED 05:00 DAILY", "label", { token: "textMuted" }, { x: 20, y: 744, w: 350, h: 16 }),
  ];
  const t: Territory = {
    id, posture: "DISTINCTIVE", name: "Quiet Editorial", status: "PROPOSED",
    thesis: "An oversized, magazine-like page that sells one thing so confidently it becomes memorable.",
    technique: "Cross-domain metaphor: a single-feature magazine cover. One idea per screen, large type, overlapping images, one bright block.",
    signature: "The accent block that sits across the edge of the imagery and moves with the page.",
    strengths: ["Ownable and memorable", "Strong brand recall from the first view", "Works with few, excellent images"],
    risks: ["Needs disciplined content: one story at a time", "Large type needs careful responsive rules", "Dark surface demands strong photography"],
    tokens,
    genome: gen({
      composition: ["Asymmetric, overlapping image planes under large type", "Creates a focal path and a memorable first view", "medium"], typography: ["Very large serif display, tiny tracked labels", "Scale contrast is the hierarchy", "high"],
      imagePhilosophy: ["Close crops of the craft, never staged smiles", "Proof of care, not decoration", "medium"], spatialBehaviour: ["Tight type, loose margins, elements cross edges", "Tension reads as confidence", "medium"],
      density: ["Very low", "One idea per view", "high"], shapeLanguage: ["Square corners, hard edges", "Printed, editorial feel", "high"],
      colourBehaviour: ["Warm dark with one brass accent", "The accent marks the single action", "high"], motionLanguage: ["Slow, ease-in-out reveals", "Mimics turning a page", "low"],
      interactionLanguage: ["Few, large targets", "Reduces choice to one action", "medium"], textureMaterial: ["Matte, ink-on-paper", "Quiet luxury without gloss", "medium"],
      visualMetaphor: ["Magazine cover", "Makes one product feel like a feature story", "medium"], signatureDevice: ["The accent block across the image edge", "A repeatable, ownable mark", "medium"],
    }),
  };
  return { t, frames, nodes };
};

const experimental = (): { t: Territory; frames: Frame[]; nodes: SNode[] } => {
  const id = "terr-experimental";
  const tokens: Tokens = {
    color: { surface: "#0F2B2E", surfaceAlt: "#17444A", text: "#F5F1E6", textMuted: "#B4CBC7", accent: "#FF7A59", accentText: "#1A0F0B", border: "#2F5E64", focus: "#FFD166" },
    type: { display: { family: "grotesk", size: 92, weight: 700, tracking: -3, lineHeight: 0.92 }, heading: { family: "grotesk", size: 26, weight: 700, tracking: -0.5, lineHeight: 1.1 }, body: { family: "mono", size: 15, weight: 400, tracking: 0, lineHeight: 1.6 }, label: { family: "mono", size: 11, weight: 700, tracking: 1.6, lineHeight: 1.2 } },
    radius: { sm: 2, md: 12, lg: 28 }, space: { base: 8 }, motion: { durationMs: 600, easing: "ease-in-out" },
  };
  const d = `${id}-desktop`, m = `${id}-mobile`;
  const frames: Frame[] = [{ id: d, territoryId: id, name: "Home, desktop", viewport: "desktop", w: 1280, h: 800 }, { id: m, territoryId: id, name: "Home, mobile", viewport: "mobile", w: 390, h: 800 }];
  const cols = ["Choose", "Reserve", "Collect", "Return"];
  const nodes: SNode[] = [
    text(d, "logo", "brand name", "northwind/", "heading", { token: "text" }, { x: 56, y: 32, w: 240, h: 32 }),
    text(d, "index", "page index", "INDEX 01—04", "label", { token: "textMuted" }, { x: 1056, y: 40, w: 168, h: 16, align: "right" }),
    text(d, "headline", "headline", "Begin anywhere.", "display", { token: "text" }, { x: 56, y: 100, w: 940, h: 108 }),
    rect(d, "sun", "signature device", "Orbit", { x: 1000, y: 72, w: 208, h: 208, radius: "full", fill: { token: "accent" } }),
    ...cols.flatMap((c, i) => [
      rect(d, `col${i}`, "step card", `Step ${i + 1}`, { x: 56 + i * 300, y: 296, w: 280, h: 400, radius: "lg", fill: { token: "surfaceAlt" } }),
      rect(d, `col${i}s`, "step marker", `Marker ${i + 1}`, { x: 56 + i * 300, y: 296, w: 280, h: 10, fill: { token: "accent" } }),
      text(d, `col${i}n`, "step number", `0${i + 1}`, "heading", { token: "accent" }, { x: 80 + i * 300, y: 332, w: 120, h: 32 }),
      text(d, `col${i}t`, "step title", c, "heading", { token: "text" }, { x: 80 + i * 300, y: 572, w: 232, h: 32 }),
      text(d, `col${i}b`, "step detail", ["Pick what you need.", "Hold it for a day.", "Walk in, take it.", "Bring the box back."][i] ?? "", "body", { token: "textMuted" }, { x: 80 + i * 300, y: 612, w: 232, h: 56 }),
    ]),
    button(d, "primary", "primary action", "START HERE", { token: "accent" }, { token: "accentText" }, { x: 56, y: 724, w: 200, h: 52, radius: "full" }),
    text(m, "logo", "brand name", "northwind/", "heading", { token: "text" }, { x: 20, y: 24, w: 200, h: 32 }),
    text(m, "headline", "headline", "Begin anywhere.", "display", { token: "text" }, { x: 20, y: 80, w: 350, h: 124, size: 52 }),
    rect(m, "sun", "signature device", "Orbit", { x: 238, y: 252, w: 132, h: 132, radius: "full", fill: { token: "accent" } }),
    ...[0, 1].flatMap((i) => [
      rect(m, `col${i}`, "step card", `Step ${i + 1}`, { x: 20, y: 408 + i * 168, w: 350, h: 152, radius: "lg", fill: { token: "surfaceAlt" } }),
      text(m, `col${i}t`, "step title", `0${i + 1}  ${cols[i] ?? ""}`, "heading", { token: "text" }, { x: 40, y: 432 + i * 168, w: 300, h: 32 }),
      text(m, `col${i}b`, "step detail", ["Pick what you need.", "Hold it for a day."][i] ?? "", "body", { token: "textMuted" }, { x: 40, y: 476 + i * 168, w: 300, h: 56 }),
    ]),
    button(m, "primary", "primary action", "START HERE", { token: "accent" }, { token: "accentText" }, { x: 20, y: 744, w: 350, h: 48, radius: "full" }),
  ];
  const t: Territory = {
    id, posture: "EXPERIMENTAL", name: "Spatial Ledger", status: "PROPOSED",
    thesis: "The page as a long, sliding ledger: the steps of the service become the architecture of the screen.",
    technique: "Environmental dimensioning: the interface is laid out as the physical journey (choose, reserve, collect, return), so structure explains the service.",
    signature: "An orbit disc that travels the ledger as the visitor moves through the steps.",
    strengths: ["Explains the service by its structure alone", "Highly distinctive and shareable", "Natural fit for a step-by-step proposition"],
    risks: ["Horizontal movement needs a solid keyboard and reduced-motion story", "Unusual patterns raise testing needs", "Mono body text must stay readable at length"],
    tokens,
    genome: gen({
      composition: ["Four tall columns read as a timeline", "Layout is the explanation", "medium"], typography: ["Oversized grotesk display with mono body", "Technical, precise, unmistakable", "medium"],
      imagePhilosophy: ["Diagrammatic first, photographic second", "Process matters more than product here", "low"], spatialBehaviour: ["Columns of equal weight; the disc breaks the grid", "Rhythm with one deliberate exception", "medium"],
      density: ["Medium", "Four steps need to be seen together", "medium"], shapeLanguage: ["Large radii against hard strips", "Soft cards, sharp markers", "medium"],
      colourBehaviour: ["Deep teal with one hot accent", "The accent marks progress", "high"], motionLanguage: ["Slow, continuous travel", "Conveys movement through steps", "low"],
      interactionLanguage: ["Sliding between steps", "Needs a clear non-motion alternative", "low"], textureMaterial: ["Flat, graphic", "Lets structure carry the idea", "medium"],
      visualMetaphor: ["A ledger or timetable", "Matches the service's logic", "medium"], signatureDevice: ["The orbit disc", "A memorable, movable mark", "medium"],
    }),
  };
  return { t, frames, nodes };
};

export function makeSampleDocument(projectId: string, projectName: string, actor: string): DesignDocument {
  const parts = [conservative(), distinctive(), experimental()];
  const now = new Date().toISOString();
  return {
    schemaVersion: SDD_SCHEMA,
    documentId: `sdd-${projectId}`,
    projectId,
    projectName,
    revision: 1,
    status: "DRAFT",
    mandate: {
      objective: `Give ${projectName} a design direction that makes the first action obvious and the brand easy to remember.`,
      audience: "First-time visitors deciding in under a minute whether to trust and order.",
      constraints: ["WCAG 2.2 AA contrast for all text", "Mobile-first: every territory has a mobile key frame", "Real photography to be supplied; placeholders must stay marked"],
      nonGoals: ["No production code or implementation in this domain", "No new brand positioning"],
    },
    meaningModel: { meaning: "Care, craft and ease: made properly, and simple to get.", perception: "Trustworthy, warm, and clear about what to do next." },
    territories: parts.map((p) => p.t),
    selectedTerritoryId: null,
    frames: parts.flatMap((p) => p.frames),
    nodes: parts.flatMap((p) => p.nodes),
    annotations: [],
    decisionLog: [{ id: "dec-1", at: now, by: "Design (fixture provider)", kind: "NOTE", summary: "Three territories proposed: Confident Refinement, Quiet Editorial and Spatial Ledger.", rationale: "Placeholder exploration so the Workshop can be exercised before a model is connected.", affected: parts.map((p) => p.t.id) }],
    approvals: [],
    revisions: [{ n: 1, at: now, by: "Design (fixture provider)", summary: "Territories proposed" }],
    checkpoints: [],
    provenance: { createdBy: actor, createdAt: now, generator: "fixture-provider", note: "Schema-shaped placeholder output. Not produced by a design model." },
  };
}
