// Runs inside the v4 checkout (cwd = V4_DIR) so it can use v4's own code. Stands in for Content's finished copy step on a project
// with an approved design (v4 ADR-0081 Decision 13: Media plays the approved words, never writes them): a completed generate-copy
// task whose units give short words for every content slot of the chosen direction's frames. The words are checked against the
// pack's own output schema first, so the deck the studio reads is one v4 would accept from a real run.
// With --script it also writes the deck's script group (v4 ADR-0085 Decision 4): three lines for an explainer to say, in order.
// Usage: tsx copy-seed.mjs <projectId> [--script]
import { createRequire } from "node:module";
const root = process.cwd();
const { PrismaClient } = createRequire(`${root}/package.json`)("@prisma/client");
const { approvedDesignOf } = await import(`${root}/packages/runs/src/media-step.ts`);
const { renderFrame, contentRefOf } = await import(`${root}/packages/rendering/src/sdd-html.ts`);
const { objectStorageFromEnv } = await import(`${root}/packages/assets/src/storage-config.ts`);
const { packRegistry } = await import(`${root}/packages/packs/src/index.ts`);

const [projectId] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const withScript = process.argv.includes("--script");
const SCRIPT = ["You say what you need.", "The agency plans and builds it.", "And checks every step."];
const db = new PrismaClient();
try {
  const storage = objectStorageFromEnv(process.env, { secret: "e2e", port: "4100" });
  const approved = await approvedDesignOf(db, storage, projectId);
  if (!approved) throw new Error("the project has no approved design");
  const d = approved.document;
  const frames = d.frames.filter((f) => f.width && (!d.selectedTerritoryId || f.territoryId === d.selectedTerritoryId));
  const keys = [...new Set(frames.flatMap((f) => [...renderFrame(d, f.id).matchAll(/data-slot="([^"]+)"/g)].map((m) => m[1])))];
  // Each slot's own limit, so the words fit the box Design drew for them (a stamp of 12 characters gets a short one).
  const limits = new Map();
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== "object") return;
    const ref = "content" in o ? contentRefOf(o) : null;
    if (ref?.maxChars) limits.set(ref.key, Math.min(limits.get(ref.key) ?? Infinity, ref.maxChars));
    Object.values(o).forEach(walk);
  };
  walk(frames);
  const WORDS = ["Small batches", "Dated by hand", "Fresh roast", "No. 42", "Hi"];
  const fit = (key) => { const max = Math.floor((limits.get(key) ?? 40) * 0.6); return WORDS.find((w) => w.length <= max) ?? WORDS[WORDS.length - 1]; };
  const words = new Map(keys.map((k) => [k, fit(k)]));
  // As Content would, the words are written to fit the box Design drew: each frame is drawn with them in Chromium, read the way
  // media-validate reads it, and a slot whose words overflow gets shorter ones.
  const { chromium } = createRequire(`${root}/package.json`)("playwright");
  const browser = await chromium.launch(process.env.RENDERER_CHROMIUM_PATH ? { executablePath: process.env.RENDERER_CHROMIUM_PATH } : {});
  try {
    const page = await browser.newPage();
    for (let round = 0; round < WORDS.length; round++) {
      const over = new Set();
      for (const f of frames) {
        await page.setViewportSize({ width: Math.round(f.width), height: Math.round(f.height ?? 1000) });
        await page.setContent(renderFrame(d, f.id, { copy: Object.fromEntries(words) }));
        const keysOver = await page.evaluate(() => [...document.querySelectorAll("[data-slot]")].filter((e) => e.childElementCount === 0 && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)).map((e) => e.dataset.slot));
        keysOver.forEach((k) => over.add(k));
      }
      if (!over.size) break;
      for (const k of over) { const i = WORDS.indexOf(words.get(k)); words.set(k, WORDS[Math.min(WORDS.length - 1, i + 1)]); }
    }
  } finally { await browser.close(); }
  const units = keys.map((key, i) => ({ unit_id: `u${i + 1}`, key, key_group: "home", purpose: key, text: words.get(key), claim_refs: [] }));
  if (withScript) units.push(...SCRIPT.map((text, i) => ({ unit_id: `s${i + 1}`, key: `explainer_line_${i + 1}`, key_group: "script", purpose: `explainer line ${i + 1}`, text, claim_refs: [] })));
  const outputs = { units, open_items: [] };
  const check = packRegistry().outputSchemaOf("generate-copy").validator.safeParse(outputs);
  if (!check.success) throw new Error(`the stand-in copy deck is not one v4 accepts: ${JSON.stringify(check.error.issues.slice(0, 3))}`);
  await db.task.create({ data: { projectId, title: "Write the copy", domain: "CONTENT", capability: "generate-copy", status: "COMPLETED", completedAt: new Date(), outputs } });
  console.log(JSON.stringify({ projectId, words: Object.fromEntries(words) }));
} finally { await db.$disconnect(); }
