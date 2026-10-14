// The rooms come from v4's pack registry (GET /v1/domains, dev-playbook-v4 ADR-0017). This fails when a list of domain codes
// appears in this repo again: any file but the demo fixtures that quotes three or more distinct codes.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const FIXTURES = "src/lib/data/fixtures.ts";
// The check's own copy of the codes, held to the fixtures' list below so the two cannot drift apart.
const CODES = ["BUSINESS", "MARKET", "BRAND", "CONTENT", "DESIGN", "MARKETING", "ENGINEERING", "STRATEGY", "SOCIAL_GROWTH"];

const fixtureCodes = [...readFileSync(join(root, FIXTURES), "utf8").matchAll(/\["([A-Z_]+)", "[^"]+", "(?:contract|advisory-standin)"\]/g)].map((m) => m[1]);
const problems = [];
if (fixtureCodes.join() !== CODES.join()) problems.push(`${FIXTURES}: its domains (${fixtureCodes.join(", ")}) differ from this check's (${CODES.join(", ")})`);

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|mjs|js)$/.test(name) ? [p] : [];
});
for (const file of [...walk(join(root, "src")), ...walk(join(root, "e2e"))]) {
  const rel = relative(root, file);
  if (rel === FIXTURES) continue;
  const text = readFileSync(file, "utf8");
  const found = CODES.filter((c) => new RegExp(`["'\`]${c}["'\`]`).test(text));
  if (found.length >= 3) problems.push(`${rel}: quotes ${found.join(", ")}; read the domains from useDomains() instead`);
}
if (problems.length) {
  console.error(`check-domain-lists: a list of domains outside the API (ADR-0017):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("check-domain-lists ok");
