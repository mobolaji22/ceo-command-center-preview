// The agency's brand is data (dev-playbook-v4 ADR-0093, ADR-0091 Decision 8): every screen reads its name, line and voice through
// the DataSource (useAgencyBrand), so rebranding is editing one record. This fails when a screen types the brand instead: the demo
// brand's name or line, or a name the agency traded under before, anywhere in src/ or e2e/ but the demo's own record.
// Its colours and typefaces join the check (v4 ADR-0099 Decision 11, as ADR-0093 Decision 6 foresaw): once a direction is approved,
// a screen that types one of the brand's colour values or typeface names has written the brand down instead of reading
// `--brand-*` from the theme provider (src/lib/brand-theme.tsx). The check proves itself on a seeded look before it reads the repo.
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
const wordsOf = (b) => [b.name, b.line, ...RETIRED].filter((s) => typeof s === "string" && s.trim())
  .map((s) => ({ said: s, re: new RegExp(escape(s).replace(/\\? /g, "\\s*"), "i") }));
/** A colour value as written anywhere (`#4E3A8C`, `#4e3a8c`), and a typeface by name, but not the generic families every stack ends with. */
const GENERIC = new Set(["serif", "sans-serif", "monospace", "system-ui", "cursive", "fantasy"]);
const lookOf = (b) => {
  const look = b.look;
  if (!look) return [];
  const colours = Object.values(look.colours ?? {}).filter((v) => typeof v === "string" && v.trim())
    .map((v) => ({ said: v.trim(), re: new RegExp(`(?<![\\w-])${escape(v.trim())}(?![\\w-])`, "i") }));
  const faces = [...new Set(Object.values(look.type ?? {}).map((t) => (t.typeface ?? t.family ?? "").trim()))].filter((f) => f && !GENERIC.has(f.toLowerCase()))
    .map((f) => ({ said: f, re: new RegExp(`(?<![\\w-])${escape(f).replace(/ /g, "[ -]?")}(?![\\w-])`, "i") }));
  return [...colours, ...faces];
};
const SEEDED = { name: "Seeded", line: null, look: { colours: { surface: "#F3EFE7", text: "#1D1B19" }, type: { body: { family: "Source Serif 4", typeface: null } } } };
const seededBans = [...wordsOf(SEEDED), ...lookOf(SEEDED)];
const selfTest = ["color: #f3efe7;", 'font-family: "Source Serif 4", serif;'].filter((line) => !seededBans.some((b) => b.re.test(line)));
if (selfTest.length) {
  console.error(`check-brand-strings: the check no longer catches a typed brand colour or typeface (${selfTest.join(" | ")})`);
  process.exit(1);
}
const banned = wordsOf(brand);
// A look is checked in code and styles; a JSON file under src/ is a record (a client's sample design may share a typeface with ours).
const lookBanned = lookOf(brand);

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
    if (!rel.endsWith(".json")) for (const b of lookBanned) if (b.re.test(line)) problems.push(`${rel}:${i + 1}: types the brand's "${b.said}"; read var(--brand-...) from the theme provider instead`);
  });
}
if (problems.length) {
  console.error(`check-brand-strings: the brand is typed into a screen (v4 ADR-0093):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("check-brand-strings ok");
