import type { BrandBookView, ClientBookView, MarketReportView } from "./v4";

/**
 * The demo's book for Northwind Bakery's storefront project: the Brand book and the Market report for Northwind Bakery's storefront project, shaped exactly as v4 serves them. They exist
 * so the documents can be designed with no backend; v4 writes the real ones from a run's checked outputs.
 */
const source = (taskId: string, schemaId: string, completedAt: string) => ({ runId: "run-demo-1", taskId, schemaId, completedAt });

function sampleBrandBook(audience: BrandBookView["audience"], completedAt: string): BrandBookView {
  return {
    kind: "BRAND_BOOK",
    audience,
    source: source("t-brand", "pack:BRAND/brand-direction.output/4", completedAt),
    position: {
      id: "p1",
      statement: "The neighbourhood bakery that tells you when your bread came out of the oven.",
      difference: "Every loaf on the shelf and on the site carries its bake time, so freshness is something you can check rather than a promise.",
      reasonToBelieve: "The ovens run three bakes a day, at 6, 11 and 3, and each tray is labelled as it comes out.",
      signatureDevice: "The bake-time stamp",
      status: "FACT",
      epistemicClass: "ASKED",
    },
    alternatives: [
      { id: "p2", statement: "Slow bread for busy mornings.", difference: "Pre-ordered loaves ready at the door by 7." },
      { id: "p3", statement: "The bakery that bakes for the street it is on.", difference: "A rotating loaf named after a neighbour each month." },
    ],
    audienceStatement: "People within a fifteen-minute walk who buy bread several times a week and notice when it is stale.",
    foundation: {
      statements: [
        { kind: "purpose", articulation: "To make good bread an ordinary part of the week, not a weekend treat.", source: "The owner's intake answer: \"bread you can have every day\"." },
        { kind: "mission", articulation: "Bake three times a day, label every tray, and sell what was baked today.", source: "The owner's description of the daily routine." },
      ],
      values: [
        { value: "Honest", behavior: "We put the bake time on the label, even when it is the morning bake at 4 in the afternoon." },
        { value: "Neighbourly", behavior: "We hold a regular's loaf until closing if they ask." },
      ],
      notSourced: [{ kind: "vision", reason: "The owner has not said where the bakery should be in five years, so no vision is written for them." }],
    },
    story: {
      world: "On this street most bread is bought from a supermarket shelf, where nobody can say when it was baked.",
      tension: "People who care about bread end up buying it on Saturdays only, because they cannot trust it on a Tuesday.",
      belief: "Fresh bread should be something you can check, every day of the week.",
      solution: "Northwind bakes three times a day and stamps each tray with the time it came out of the oven.",
      proof: "The bake-time stamp is on every loaf on the shelf and on the website.",
      future: "Regulars plan their walk past the bakery around the 11 o'clock bake.",
    },
    promise: { statement: "Bread you can trust on a Tuesday.", expectedOutcome: "Customers buy bread through the week, not just at weekends.", scope: "Bread and morning bakes, in the shop and online." },
    personality: {
      traits: [
        { dimension: "Warm or reserved", position: "Warm", behavior: "Greets regulars by name; signs off notes from \"the bakers\"." },
        { dimension: "Playful or plain", position: "Plain, with a dry smile", behavior: "States the facts; lets the bake time do the boasting." },
      ],
      refuses: ["Artisanal", "Crafted with love", "Exclamation marks in prices"],
    },
    voice: {
      name: "The baker at the counter",
      why: "Customers trust the person who can tell them when the loaf came out, so the voice sounds like that person.",
      wordsWeUse: ["baked at", "this morning's", "still warm", "today"],
      wordsWeAvoid: ["artisanal", "handcrafted", "premium", "world-class"],
      sampleLines: [
        { line: "Sourdough, baked at 6:10 this morning.", type: "shelf label" },
        { line: "The 11 o'clock bake is out. Rye's still warm.", type: "social post" },
      ],
    },
    look: {
      personality: "A morning kitchen: flour-pale, warm, unfussy.",
      principles: ["The bake time is always the most legible thing on a label", "Photograph bread on the bench it came off, never on props"],
      typographyCharacter: "A sturdy, plain serif for names; a monospaced face for times, like a stamp.",
      colorRole: "Neutral, flour-toned ground; one warm crust colour reserved for the stamp.",
      shapeLanguage: "Rectangular labels with rounded corners, like a baker's tag.",
      antiPatterns: ["Chalkboard script", "Wheat-sheaf clip art", "Rustic wood textures"],
      distinctiveAssets: [{ asset: "The bake-time stamp", type: "graphic device", observableAs: "A time in a rounded rectangle on every label, post and page." }],
    },
    heldFiles: { noneHeld: false, entries: [{ heldRef: "Northwind logo (2019)", brandItem: "Logo", compatible: "yes", note: "The wordmark stays; the wheat sheaf beside it is retired." }] },
    kit: {
      pitch: {
        oneSentence: "Northwind is the neighbourhood bakery that tells you when your bread came out of the oven.",
        threeSentences: "Northwind is the neighbourhood bakery that tells you when your bread came out of the oven. We bake three times a day, at 6, 11 and 3, and stamp every tray with its bake time. So the bread you buy on a Tuesday is as fresh as the bread you buy on a Saturday.",
      },
      boilerplate: {
        short: "Northwind Bakery bakes three times a day and stamps every loaf with the time it came out of the oven, so freshness is something customers can check.",
        long: "Northwind Bakery is a neighbourhood bakery that bakes three times a day, at 6, 11 and 3. Every tray is stamped with its bake time, in the shop and on the website, so customers can see exactly how fresh their bread is. The bakery sells what it baked today, and holds a regular's loaf until closing if they ask.",
      },
      taglines: [
        { line: "Bread you can trust on a Tuesday.", rationale: "The promise, in the customer's week." },
        { line: "Baked at 6:10. Bought at 6:30.", rationale: "The bake-time stamp, as a line." },
        { line: "Check the time, not the claim.", rationale: "The difference against vague freshness claims." },
      ],
      bios: [
        { channel: "instagram", text: "Baked three times a day. Every loaf stamped with its bake time. 6 · 11 · 3." },
        { channel: "google_business_profile", text: "Neighbourhood bakery. Three bakes a day, every tray stamped with the time it came out of the oven." },
      ],
      adHeadlines: [
        { text: "Fresh is a time, not a word.", angle: "difference" },
        { text: "The 11 o'clock bake is out.", angle: "moment" },
        { text: "Bread you can trust on a Tuesday.", angle: "promise" },
      ],
      keyMessages: [
        { audience: "Weekday regulars", message: "Fresh bread every day, not just at weekends.", proof: "Three bakes a day, each stamped with its time." },
        { audience: "Online customers", message: "You can see when your loaf was baked before you order.", proof: "The bake time is shown on every product page." },
      ],
      source: source("t-kit", "pack:CONTENT/brand-kit.output/1", completedAt),
    },
    checks: ["Every sample line and story sentence traces to the owner's own words.", "The handoff check passed."],
    stillToConfirm: ["The 3 o'clock bake runs on weekdays only; confirm before the weekend signage is made."],
  };
}

function sampleMarketReport(audience: MarketReportView["audience"], completedAt: string): MarketReportView {
  const finding = (id: string, area: string, claim: string, status: MarketReportView["findings"][number]["status"], level: "low" | "medium" | "high", basis: string, locator: string) =>
    ({ id, area, claim, status, confidence: { level, basis }, asOf: "2026-10-01", sources: [{ locator, capturedAt: "2026-10-02", dataAsOf: "2026-10-01" }] });
  return {
    kind: "MARKET_REPORT",
    audience,
    source: source("t-research", "pack:MARKET/research.output/3", completedAt),
    state: "FILLED",
    banner: null,
    question: "Is there room for a weekday-fresh bakery on Northwind's street, and what do the alternatives charge?",
    decision: { decision: "Whether to lead the redesign with weekday freshness", decider: "The owner", ifAnswerChanges: "Lead with the weekend range instead." },
    field: { name: "Neighbourhood bakeries and supermarket bread", audience: "People within a fifteen-minute walk" },
    scope: { geography: ["Northwind's postcode district"], segment: "Everyday bread", window: "The last twelve months" },
    summaries: [
      { area: "competitor", summary: "Two bakeries and one supermarket sell bread within a fifteen-minute walk. Neither bakery shows when its bread was baked; the supermarket labels a packing date, not a bake time.", findingIds: ["f-1", "f-2"] },
      { area: "pricing", summary: "A sourdough loaf costs between £3.80 and £4.60 at the two bakeries, and £2.50 at the supermarket. The bakeries' prices did not change this year.", findingIds: ["f-3"] },
      { area: "demand", summary: "Local search for \"fresh bread\" peaks on Saturdays and is lowest on Tuesdays and Wednesdays, which matches the owner's till data.", findingIds: ["f-4"] },
    ],
    findings: [
      finding("f-1", "competitor", "Two independent bakeries trade within a fifteen-minute walk.", "FACT", "high", "Both shops visited and their sites read.", "Site visit notes, 2 October"),
      finding("f-2", "competitor", "Neither nearby bakery shows a bake time on its shelf labels or website.", "FACT", "medium", "Shelves seen on one morning visit each.", "Site visit notes, 2 October"),
      finding("f-3", "pricing", "A sourdough loaf is £3.80 and £4.60 at the two bakeries, and £2.50 at the supermarket.", "FACT", "medium", "Prices read on the day; not tracked over time.", "Price check, 2 October"),
      finding("f-4", "demand", "Search interest in \"fresh bread\" locally is highest on Saturdays and lowest midweek.", "INFERRED", "low", "A small local sample; the pattern matches the owner's till data.", "Search trend export, 12 months"),
    ],
    competitors: [
      { name: "Corner Loaf", class: "direct", findingIds: ["f-1", "f-2", "f-3"] },
      { name: "Hill Street Bakehouse", class: "direct", findingIds: ["f-1", "f-2", "f-3"] },
      { name: "The supermarket in-store bakery", class: "substitute", findingIds: ["f-3"] },
    ],
    gaps: [{ section: "Sizing", missing: "How many households buy bread several times a week", reason: "No local panel data was available", wouldFill: "A short customer survey at the till", couldChange: "How much weekday trade the change could add" }],
    contradictions: [],
    coverage: [{ section: "Competitors", searched: true, depth: "Every bakery within a fifteen-minute walk" }, { section: "Sizing", searched: false, depth: "Not searched: no source" }],
    forYourBusiness: {
      summary: "The street has no bakery that shows its bake time, and weekday demand is the weakest part of the week. That combination is where the evidence points, with one gap: how many neighbours buy bread midweek at all.",
      implications: [
        { kind: "opportunity", lens: "commercial", statement: "A visible bake time would be something neither nearby bakery offers today.", findingIds: ["f-2"], status: "INFERRED", epistemicClass: "DERIVED", wouldChangeIt: "Either rival starting to label bake times." },
        { kind: "risk", lens: "economic", statement: "Three bakes a day cost more to run than one, and midweek demand is the lowest of the week.", findingIds: ["f-4"], status: "INFERRED", epistemicClass: "DERIVED", wouldChangeIt: "A till survey showing more midweek buyers than the search data suggests." },
        { kind: "question_to_decide", lens: "business_model", statement: "Whether to price at the rivals' level or between them and the supermarket.", findingIds: ["f-3"], status: "FACT", wouldChangeIt: "A change in either bakery's prices." },
      ],
      source: source("t-implications", "pack:BUSINESS/market-implications.output/1", completedAt),
    },
    checks: ["Every summary cites findings that exist, in its own area.", "No summary tells you what to do; Business's chapter interprets the evidence."],
  };
}

export function sampleBook(audience: ClientBookView["audience"], completedAt: string): ClientBookView {
  return { kind: "BOOK", audience, brand: sampleBrandBook(audience, completedAt), market: sampleMarketReport(audience, completedAt), toCome: [] };
}
