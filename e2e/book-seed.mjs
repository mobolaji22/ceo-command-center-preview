// Runs inside the v4 checkout (cwd = V4_DIR) so it can use v4's own code. Stands in for a finished Brand run on the client's newest
// project: a chosen position with a clean handoff lint, Content's brand kit, and Market's research still drafted (no snapshot can be
// filled before live research, ADR-0042 wave B). Every output is checked against its pack's schema first, so the book the test reads
// is the one v4 would build from a real run.
// Usage: tsx book-seed.mjs <client owner email>. Prints the project the book belongs to.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const root = process.cwd();
const { PrismaClient } = createRequire(`${root}/package.json`)("@prisma/client");
const { packRegistry } = await import(`${root}/packages/packs/src/index.ts`);
const { BOOK_CHAPTER_WRITERS } = await import(`${root}/packages/contracts/src/index.ts`);
// Which domain writes each chapter is v4's to say; this only asks.
const writerOf = (capability) => Object.entries(BOOK_CHAPTER_WRITERS).find(([, c]) => c === capability)[0];

const [ownerEmail] = process.argv.slice(2);
const db = new PrismaClient();

const HOOKS = ["conflict", "stakes", "specificity", "curiosity", "transformation", "contrast_with_named_villain", "signature_device", "conflict"];
const candidate = (n) => ({
  id: `p${n}`, statement: n === 2 ? "The roastery that prints the roast date on every bag." : `The roastery with difference ${n}.`, hook_type: HOOKS[n - 1],
  strategic_premise: "Coffee bought online is often weeks old.", difference: n === 2 ? "Every bag and every product page shows the day it was roasted." : `Difference ${n}.`,
  reason_to_believe: "The roasters roast weekly in small batches and date each bag by hand.", evidence_refs: ["the request"],
  epistemic: { status: "FACT", epistemicClass: "ASKED" }, rung: 2, strengths: ["specific"], weaknesses: ["untested"], claims_needed: [], signature_device: "The roast-date stamp",
});
const direction = {
  phase: "direction",
  frame: { audience: "Home brewers buying coffee online", decision: "What the roastery is known for", held_evidence: ["the request"], claim_rules: [], choice_rules: [], ceiling_reference: "Not measured." },
  positioning_candidates: Array.from({ length: 8 }, (_, i) => candidate(i + 1)),
  selected: { candidate: 2, id: "p2", answer: "2" },
  foundation: {
    statements: [{ kind: "mission", articulation: "Roast weekly in small batches, and say when.", source: "The owner's request: \"roasted weekly in small batches\"." }],
    values: [], not_sourced: [{ kind: "vision", reason: "The owner has not said where the roastery should be in five years." }],
  },
  narrative: {
    world: "Most coffee bought online says when it expires, not when it was roasted.", tension: "Home brewers cannot tell a fresh bag from a stale one before it arrives.",
    belief: "Freshness should be something you can read.", solution: "The roastery roasts weekly and prints the roast date on every bag.",
    proof: "The roast date is on every bag and on the product page.", future: "Subscribers know their coffee is from this week's roast.",
  },
  promise: { statement: "This week's roast, at your door.", expected_outcome: "Subscribers trust each bag", scope: "Subscriptions and single bags", operational_dependencies: ["a weekly roast"], risks: [] },
  personality: {
    dimensions: ["warmth", "precision", "pace"].map((d) => ({ dimension: d, position: "high", behavior: "States the roast date first.", expression: "Labels and emails", forbidden_behavior: "Vague freshness claims" })),
    under_tension: ["a", "b", "c", "d", "e"], refuses: ["Vague freshness", "b", "c", "d", "e"],
  },
  verbal_dna: {
    voice_directions: Array.from({ length: 6 }, (_, i) => ({ name: `v${i}`, stance: "s", sentence_habit: "short", point_of_view: "we", sample_headline: "h", sample_empty_state: "e" })),
    chosen_direction: { name: "The roaster's notebook", why: "Plain and dated, like the bag." },
    sentence_rules: { person: "we", tense: "present", length: "short", punctuation: "plain", numbers: "digits", limits: "say it" },
    words_we_use: ["roasted on", "this week"], words_we_avoid: ["artisanal"],
    sample_lines: Array.from({ length: 10 }, (_, i) => ({ line: `Roasted on Monday, batch ${i + 1}.`, type: "label", needs_device: false })),
    banned_list: [{ pattern: "artisanal", kind: "WORD", reason: "A virtue word.", replacement: "Say what is done by hand.", scope: "CLIENT", source: "Brand" }],
  },
  visual_direction: {
    visual_personality: "A roaster's bench: kraft paper and a date stamp.", principles: ["The roast date is the most legible thing", "b", "c"], typography_character: "A plain serif, with dates set like a stamp.",
    color_role: "Kraft ground; one ink colour for the date.", shape_language: "Square labels.", visual_anti_patterns: ["No coffee-bean clip art", "b", "c"],
    distinctive_assets: [{ asset: "The roast-date stamp", type: "recurring symbol", observable_as: "A date in a square on every bag", ownability_rationale: "No rival shows it", fame_status: "unknown", uniqueness_status: "hypothesis" }],
    recognition_requirements: [], trust_requirements: [],
  },
  design_compatibility: { none_held: true, entries: [] },
  provisional_markers: [],
  locale: "en-GB",
  open_items: [],
  handoff_lint: { standard: "Brand-Intelligence-Contract-v4 §93.2", schema_version: "pack:BRAND/brand-direction.output/4", items: [], findings: [], checkedAt: new Date().toISOString() },
};
const kit = {
  pitch: { one_sentence: "The roastery that prints the roast date on every bag.", three_sentences: "The roastery that prints the roast date on every bag. We roast weekly in small batches. So you know your coffee is from this week." },
  boilerplate: { short: "A small-batch roastery that roasts weekly and prints the roast date on every bag.", long: "A small-batch roastery that roasts weekly and prints the roast date on every bag and every product page, so home brewers can see how fresh their coffee is before it arrives." },
  taglines: [{ line: "Read the date, not the claim.", rationale: "The difference against vague freshness." }, { line: "This week's roast, at your door.", rationale: "The promise." }, { line: "Roasted on Monday. Yours by Wednesday.", rationale: "The week, as a line." }],
  bios: [{ channel: "instagram", text: "Roasted weekly. Dated on every bag." }],
  ad_headlines: [{ text: "Roasted on Monday. At your door on Wednesday.", angle: "moment" }, { text: "Fresh is a date.", angle: "difference" }, { text: "This week's roast, at your door.", angle: "promise" }],
  key_messages: [{ audience: "Home brewers", message: "You can see when your coffee was roasted.", proof: "The roast date on every bag." }],
  open_items: [],
};
const research = JSON.parse(readFileSync(`${root}/tests/fixtures/golden-seeds/research-orbit-competitors.json`, "utf8"));

try {
  const registry = packRegistry();
  for (const [capability, output] of [["brand-direction", direction], ["brand-kit", kit], ["research", research]]) {
    const check = registry.outputSchemaOf(capability).validator.safeParse(output);
    if (!check.success) throw new Error(`${capability}: ${JSON.stringify(check.error.issues.slice(0, 3))}`);
  }
  const owner = await db.user.findUniqueOrThrow({ where: { email: ownerEmail } });
  const membership = await db.membership.findFirstOrThrow({ where: { userId: owner.id } });
  const project = await db.project.findFirstOrThrow({ where: { organizationId: membership.organizationId }, orderBy: { createdAt: "desc" } });
  const ceo = await db.user.findFirstOrThrow({ where: { memberships: { some: { role: "CEO" } } } });
  // The project already has a plan of its own; this one takes the next version.
  const last = await db.proposal.findFirst({ where: { projectId: project.id, type: "PLAN" }, orderBy: { version: "desc" } });
  const version = (last?.version ?? 0) + 1;
  const plan = await db.proposal.create({ data: {
    organizationId: project.organizationId, projectId: project.id, type: "PLAN", status: "APPROVED", decision: "APPROVED", decidedAt: new Date(), decidedById: ceo.id,
    version, content: {}, impact: 1, reversibility: 4, decisionOwner: "CEO", authority: {}, proposedBy: "e2e", correlationId: "e2e-book",
  } });
  const run = await db.run.create({ data: { organizationId: project.organizationId, projectId: project.id, proposalId: plan.id, planVersion: version, status: "COMPLETED", endedAt: new Date() } });
  const done = (capability, outputs) => ({ projectId: project.id, runId: run.id, planTaskId: capability, title: capability, domain: writerOf(capability), capability, status: "COMPLETED", outputs, completedAt: new Date() });
  await db.task.createMany({ data: [done("brand-direction", direction), done("brand-kit", kit), done("research", research)] });
  console.log(JSON.stringify({ projectId: project.id, projectName: project.name }));
} finally { await db.$disconnect(); }
