// The agency's brand is data (dev-playbook-v4 ADR-0093, ADR-0091 Decision 8): every screen reads its name, line and voice through
// the DataSource (useAgencyBrand), so rebranding is editing one record. This fails when a screen types the brand instead: the demo
// brand's name or line, or a name the agency traded under before, anywhere in src/ or e2e/ but the demo's own record.
// Colours join the check when the brand record holds them.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const RECORD = "src/lib/data/demo-brand.json";
const brand = JSON.parse(readFileSync(join(root, RECORD), "utf8"));
// Names the agency used before it was Boxwood: typed into screens then, and never to come back.
const RETIRED = ["DevPlaybook", "Dev Playbook"];
// The demo's other records name the agency's own organization; they are data too.
const ALLOWED = new Set([RECORD, "src/lib/data/fixtures.ts"]);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const banned = [brand.name, brand.line, ...RETIRED].filter((s) => typeof s === "string" && s.trim())
  .map((s) => ({ said: s, re: new RegExp(escape(s).replace(/\\? /g, "\\s*"), "i") }));

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|mjs|js|css|json|md)$/.test(name) ? [p] : [];
});
const problems = [];
for (const file of [...walk(join(root, "src")), ...walk(join(root, "e2e"))]) {
  const rel = relative(root, file);
  if (ALLOWED.has(rel)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const b of banned) if (b.re.test(line)) problems.push(`${rel}:${i + 1}: types "${b.said}"; read it with useAgencyBrand() instead`);
  });
}
if (problems.length) {
  console.error(`check-brand-strings: the brand is typed into a screen (v4 ADR-0093):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("check-brand-strings ok");
