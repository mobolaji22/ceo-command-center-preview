import type { ClientBookView } from "./deliverables.generated";

/**
 * The client's book (dev-playbook-v4 ADR-0053, ADR-0054): one document with a brand part (the Brand book, with Content's kit) and a
 * market part (the Market report, with Business's chapter). Its shape is v4's: the types are generated from the schema v4 publishes
 * (`npm run v4:types`). v4 decides who may read each part and when, and builds every sentence in it; this file only names its parts
 * and puts v4's words for things into plain English.
 */
export type { ClientBookView };
export type BrandBookView = NonNullable<ClientBookView["brand"]>;
export type MarketReportView = NonNullable<ClientBookView["market"]>;
export type Finding = MarketReportView["findings"][number];
export type Implication = NonNullable<MarketReportView["forYourBusiness"]>["implications"][number];
export type EpistemicStatus = Finding["status"];

/**
 * The agency's proposal that a kept Brand book stands in for Brand on the client's next projects (ADR-0026). The client's owner
 * decides it; until then it changes nothing.
 */
export type KeptBrand = {
  proposalId: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED" | "SUPERSEDED" | "WITHDRAWN";
  /** Why the agency says it can do Brand's job, in its own words. */
  fitness: string;
  /** The kept book's version in the organization's library. */
  version: number;
  submittedAt: string | null;
  decidedAt: string | null;
};

/** How well a statement is known, in the words a reader uses (v4's labels, Market §4). */
export const STATUS_WORDS: Record<EpistemicStatus, string> = {
  FACT: "Fact", INFERRED: "Inferred", ASSUMPTION: "Assumption", UNKNOWN: "Unknown", CONFLICT: "Sources disagree",
};

const AREA_WORDS: Record<string, string> = {
  category: "The category", competitor: "Competitors", demand: "Demand", pricing: "Pricing", trend: "Trends",
  regulatory: "Rules and regulation", structure: "How the market is structured", sizing: "Market size", change: "What is changing",
};
/** A research area's heading. An area v4 adds later reads as its own name until it has words here. */
export const areaWords = (area: string) => AREA_WORDS[area] ?? sentence(area);

const CHANNEL_WORDS: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", x: "X", tiktok: "TikTok",
  google_business_profile: "Google Business Profile", website_footer: "Website footer", email_signature: "Email signature",
};
export const channelWords = (channel: string) => CHANNEL_WORDS[channel] ?? sentence(channel);

/** The headings the business chapter groups its implications under, in the order it reads them. */
export const IMPLICATION_HEADINGS: Record<Implication["kind"], string> = { opportunity: "Opportunities", risk: "Risks", question_to_decide: "Questions to decide" };
const LENS_WORDS: Record<string, string> = { economic: "Economics", business_model: "Business model", operating: "Operations", capability: "Capability", commercial: "Commercial" };
export const lensWords = (lens: string) => LENS_WORDS[lens] ?? sentence(lens);

export const COMPETITOR_WORDS: Record<MarketReportView["competitors"][number]["class"], string> = {
  direct: "Direct", indirect: "Indirect", substitute: "Substitute", status_quo: "Doing nothing",
};

export const FOUNDATION_WORDS: Record<NonNullable<BrandBookView["foundation"]>["statements"][number]["kind"] | "values", string> = {
  purpose: "Purpose", vision: "Vision", mission: "Mission", values: "Values",
};

/** The six parts of the brand story, in the order it is told (Brand §25). */
export const STORY_PARTS: Array<{ key: keyof NonNullable<BrandBookView["story"]>; title: string }> = [
  { key: "world", title: "The world" }, { key: "tension", title: "The tension" }, { key: "belief", title: "What we believe" },
  { key: "solution", title: "What we do about it" }, { key: "proof", title: "The proof" }, { key: "future", title: "Where it goes" },
];

function sentence(code: string) {
  const words = code.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The findings a summary or an implication rests on, in the report's order, so each sentence can show its evidence. */
export function findingsFor(report: MarketReportView, ids: readonly string[]): Finding[] {
  const wanted = new Set(ids);
  return report.findings.filter((f) => wanted.has(f.id));
}
