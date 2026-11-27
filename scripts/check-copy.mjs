// The Command Center's own words meet the work standard (dev-playbook-v4 ADR-0099 Decision 12). Every word a screen shows lives in a
// copy file per surface (src/copy/*.json); this reads each string there with the patterns v4 reads a reader's words with: the work
// standard's floor (unfinished work and the AI tells, Charter §The work standard) and the expression step's literal-copy check
// (ADR-0097). The patterns are v4's, published as packages/contracts/schemas/reader-words.json and copied here, never written here.
//
//   node scripts/check-copy.mjs            lint the copy; fail if the copied patterns differ from v4's when a checkout is present
//   node scripts/check-copy.mjs --update   copy v4's patterns (V4_DIR, default ../dev-playbook-v4)
//
// Before it reads the copy it proves itself on seeded defects, so a broken or emptied pattern file fails instead of passing everything.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = join(import.meta.dirname, "..");
const v4 = resolve(process.env["V4_DIR"] ?? join(root, "..", "dev-playbook-v4"));
const COPIED = "scripts/v4/reader-words.json";
const FROM_V4 = join(v4, "packages/contracts/schemas/reader-words.json");
const COPY_DIR = "src/copy";

if (process.argv.includes("--update")) {
  if (!existsSync(FROM_V4)) { console.error(`check-copy: v4's patterns are not at ${FROM_V4}; set V4_DIR to a dev-playbook-v4 checkout`); process.exit(1); }
  writeFileSync(join(root, COPIED), readFileSync(FROM_V4, "utf8"));
  console.log(`wrote ${COPIED}`);
  process.exit(0);
}

const problems = [];
const copiedText = readFileSync(join(root, COPIED), "utf8");
if (existsSync(FROM_V4) && readFileSync(FROM_V4, "utf8") !== copiedText) problems.push(`${COPIED} differs from v4's (${FROM_V4}); run: node scripts/check-copy.mjs --update`);

const patterns = JSON.parse(copiedText).patterns.map((p) => ({ ...p, re: new RegExp(p.source, p.flags) }));
const findingsIn = (text) => {
  const line = text.trim();
  return patterns.flatMap((p) => { const m = p.re.exec(line); return m ? [{ defect: p.defect, words: m[0].trim() }] : []; });
};

// One seeded line per kind of defect the patterns must catch.
const SEEDS = [
  ["UNFINISHED", "TODO: write the empty state"],
  ["FILLER", "In today's fast-paced world, the studio moves quickly."],
  ["SELF_DESCRIPTION", "Here is your revised copy for the board."],
  ["DESCRIBES_SERVICE", "We build brands for founders."],
  ["VIRTUE_HOOK", "Honest work, delivered."],
];
for (const [defect, seed] of SEEDS) {
  if (!findingsIn(seed).some((f) => f.defect === defect)) problems.push(`the patterns no longer catch ${defect} in a seeded line ("${seed}"): ${COPIED} is broken or stale`);
}

const stringsIn = (value, at) =>
  typeof value === "string" ? [{ at, text: value }]
    : Array.isArray(value) ? value.flatMap((v, i) => stringsIn(v, `${at}[${i}]`))
      : value && typeof value === "object" ? Object.entries(value).flatMap(([k, v]) => stringsIn(v, at ? `${at}.${k}` : k)) : [];

let read = 0;
for (const name of readdirSync(join(root, COPY_DIR)).filter((n) => n.endsWith(".json")).sort()) {
  for (const { at, text } of stringsIn(JSON.parse(readFileSync(join(root, COPY_DIR, name), "utf8")), "")) {
    read++;
    for (const f of findingsIn(text)) problems.push(`${COPY_DIR}/${name} ${at}: "${f.words}" (${f.defect})`);
  }
}

if (problems.length) {
  console.error(`check-copy: words a reader sees fall below the work standard (v4 ADR-0099 Decision 12):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`check-copy ok (${read} lines read, ${patterns.length} patterns from v4)`);
