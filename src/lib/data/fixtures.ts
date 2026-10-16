import { loadDraft, saveDraft } from "@/lib/design/draft-store";
import type {
  Answer,
  ClientIntentView,
  Approval,
  Asset,
  ActionLinkView,
  BriefDoc,
  BudgetView,
  ClientData,
  DecisionEntry,
  DelegationView,
  NotificationItem,
  NotificationPrefs,
  OwnerData,
  PlanContent,
  PlanVersion,
  Profile,
  Project,
  Question,
  RunView,
  Session,
  V4Event,
  DomainView,
} from "../model";
import { fail, ok, type DataSource, type Result } from "./types";

/**
 * Fixtures DataSource: an in-memory, localStorage-persisted demo of the Command Center's data.
 *
 * It exists so the UI can be designed, reviewed and developed without a backend. It is NOT a
 * second source of truth: it holds fictional records only, the app shows a DEMO banner while
 * it is active, and nothing here is ever used in a production build (see lib/data/index.ts).
 *
 * It imitates server behaviour that the real API owns: events are appended by commands, and
 * client visibility is decided here the way the API will decide it.
 */

const STORE_KEY = "dpl.fixtures.v7";
const SESSION_KEY = "dpl.fixtures.session";
const CHANGE_EVENT = "dpl:fixtures-change";

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const id = () => crypto.randomUUID();

type Membership = { organizationId: string; role: "CLIENT_OWNER" | "CLIENT_MEMBER" };
type User = { id: string; email: string; displayName: string; role: "owner" | "client"; memberships: Membership[] };

/**
 * The demo's rate card and agency share (ADR-0028): the fixtures price plans the way v4 does, from stated figures, so the demo
 * shows a price. They are demo numbers, not the agency's.
 */
const DEMO_RATES: Record<string, number> = { light: 300, standard: 800, strict: 1500, critical: 2500 };
const DEMO_AGENCY_FEE_PCT = 15;
const DEMO_REVISION_ALLOWANCE = 0.2;
const fee = (n: number) => Math.round(n * DEMO_AGENCY_FEE_PCT) / 100;
function demoPrice(plan: PlanContent) {
  const low = plan.tasks.reduce((sum, t) => sum + (DEMO_RATES[t.rigor] ?? 0), 0);
  const project = { low, high: Math.round(low * (1 + DEMO_REVISION_ALLOWANCE)) };
  const agency = { low: fee(project.low), high: fee(project.high) };
  return { project, agency, total: { low: project.low + agency.low, high: project.high + agency.high } };
}
const usdText = (r: { low: number; high: number }) => `$${r.low.toLocaleString("en-US")} to $${r.high.toLocaleString("en-US")}`;
/** What a client is told changed between versions, the way v4 words it: the price, what they get, the dates and the scope. */
function demoChanges(from: PlanContent, to: PlanContent): string[] {
  const lines: string[] = [];
  const [a, b] = [demoPrice(from).total, demoPrice(to).total];
  if (a.low !== b.low || a.high !== b.high) lines.push(`Price: ${usdText(b)} (was ${usdText(a)})`);
  const diff = (x: string[], y: string[], added: string, removed: string) => {
    for (const n of y) if (!x.includes(n)) lines.push(`${added}: ${n}`);
    for (const n of x) if (!y.includes(n)) lines.push(`${removed}: ${n}`);
  };
  diff(from.deliverables.map((d) => d.name), to.deliverables.map((d) => d.name), "Added", "Removed");
  diff(from.scope_in, to.scope_in, "Now included", "No longer included");
  return lines;
}
/** The same order v4's client views use: what is asked, by impact, as it was stored. */
const STATUS_LINE = (i: { status: string; questions: unknown[] }, planReady: boolean): ClientIntentView["status"] =>
  i.questions.length ? { kind: "QUESTIONS", line: i.questions.length === 1 ? "One question for you." : `${i.questions.length} questions for you.` }
  : i.status === "RECEIVED" || i.status === "AWAITING_REASONING" ? { kind: "READING", line: "We're reading your request." }
  : planReady ? { kind: "PLAN_READY", line: "Your plan is ready." }
  : i.status === "REJECTED" || i.status === "SUPERSEDED" ? { kind: "CLOSED", line: i.status === "REJECTED" ? "This request was withdrawn." : "This request was replaced by a newer one." }
  : { kind: "PLANNING", line: "We're preparing your plan." };

type Store = { standingProjects?: string[]; data: OwnerData; users: User[]; assets: Asset[]; lastSeen: string | null; plans: PlanVersion[]; decisions: DecisionEntry[]; delegations: DelegationView[]; runs: RunView[]; questions: Question[]; links: Array<{ token: string; view: ActionLinkView }>; briefs: BriefDoc[]; prefs: Record<string, NotificationPrefs>; notifications: NotificationItem[]; budgets: Record<string, BudgetView> };

/** A demo plan: enough to show every part of the page. */
const demoPlan = (): PlanContent => ({
  objective: "Clarify the Q4 priorities and drop anything that does not move online orders",
  scope_in: ["Review of the current Q4 list", "A ranked shortlist tied to online orders"], scope_out: ["Work in any area this plan does not list"],
  deliverables: [{ id: "d-business", name: "Business work for: Q4 priorities", domain: "BUSINESS" }, { id: "d-strategy", name: "Strategy work for: Q4 priorities", domain: "STRATEGY" }],
  success_metrics: [{ id: "m1", metric: "The result you asked for", baseline: null, target: "A shortlist you can act on this quarter", measurement: "Agreed with you before work starts", window: "30 days after delivery", data_source: "To be agreed" }],
  tasks: [
    { id: "t1", title: "Clarify business objective", domain: "BUSINESS", capability: "analyze", rigor: "light", risk: 1, reversibility: 4, depends_on: [] },
    { id: "t2", title: "Develop strategic directions", domain: "STRATEGY", capability: "strategy", rigor: "strict", risk: 3, reversibility: 3, depends_on: ["t1"] },
    { id: "t3", title: "Rank the Q4 list against online orders", domain: "BUSINESS", capability: "analyze", rigor: "standard", risk: 2, reversibility: 4, depends_on: ["t2"] },
  ],
  milestones: [{ name: "Develop strategic directions: your decision", after_tasks: ["t2"] }, { name: "Delivery", after_tasks: ["t3"] }],
  budget: { low_usd: 0.63, high_usd: 1.44, confidence: 0.4 },
  risks: [{ risk: "\"Develop strategic directions\" shapes everything after it", mitigation: "It waits for your decision before the next step starts" }],
  assumptions: ["Is there a spending limit we should respect? We are going with: Use the usual range for this kind of work", "Costs are estimates by effort level, not quotes."],
  open_context_needs: ["Brand guidelines"], decision_points: [{ task_id: "t2", description: "Your decision on: Develop strategic directions" }],
});

function seed(): Store {
  const users: User[] = [
    { id: "u-ceo", email: "ceo@example.com", displayName: "Ola", role: "owner", memberships: [] },
    { id: "u-amara", email: "amara@northwind.example", displayName: "Amara Eze", role: "client", memberships: [{ organizationId: "o-1", role: "CLIENT_OWNER" }] },
    { id: "u-tunde", email: "tunde@lumen.example", displayName: "Tunde Bello", role: "client", memberships: [{ organizationId: "o-2", role: "CLIENT_OWNER" }] },
  ];
  const clients: Profile[] = users
    .filter((u) => u.role === "client")
    .map((u) => ({ id: u.id, email: u.email, display_name: u.displayName, created_at: ago(24 * 40), memberships: u.memberships.map((m) => ({ organization_id: m.organizationId, role: m.role })) }));

  const projects: Project[] = [
    { id: "p-1", organization_id: "o-1", name: "Northwind storefront redesign", description: "Redesign the online storefront and ordering flow.", objective: "Lift online orders by 25% in a quarter", status: "ACTIVE", priority: 80, domains: ["BRAND", "DESIGN", "ENGINEERING"], created_at: ago(24 * 18), started_at: ago(24 * 16), completed_at: null },
    { id: "p-2", organization_id: "o-2", name: "Lumen patient onboarding flow", description: "A calmer, shorter intake for new patients.", objective: "Cut intake abandonment in half", status: "WAITING", wait_reason: "APPROVAL", priority: 70, domains: ["STRATEGY", "DESIGN", "CONTENT"], created_at: ago(24 * 11), started_at: ago(24 * 9), completed_at: null },
    { id: "p-3", organization_id: "o-3", name: "Portfolio v2", description: "The agency's own portfolio.", objective: "Win two inbound enquiries a month", status: "PROPOSED", priority: 50, domains: ["DESIGN", "ENGINEERING"], created_at: ago(24 * 5), started_at: null, completed_at: null },
    { id: "p-4", organization_id: "o-1", name: "Northwind brand audit", description: "Audit of the existing brand system.", objective: "Know what to keep and what to retire", status: "COMPLETED", priority: 40, domains: ["BRAND"], created_at: ago(24 * 60), started_at: ago(24 * 58), completed_at: ago(24 * 35) },
  ];

  const data: OwnerData = {
    projects,
    tasks: [
      { id: "t-1", project_id: "p-1", title: "Define the meaning model", domain: "Design", status: "COMPLETED", risk: 2, reversibility: 4, approval_required: false, description: null, created_at: ago(24 * 15), started_at: ago(24 * 15), completed_at: ago(24 * 14) },
      { id: "t-2", project_id: "p-1", title: "Explore three design territories", domain: "Design", status: "COMPLETED", risk: 1, reversibility: 4, approval_required: false, description: null, created_at: ago(24 * 14), started_at: ago(24 * 14), completed_at: ago(24 * 12) },
      { id: "t-3", project_id: "p-1", title: "Build the storefront composition", domain: "Engineering", status: "RUNNING", risk: 2, reversibility: 4, approval_required: false, description: null, created_at: ago(24 * 6), started_at: ago(24 * 3), completed_at: null },
      { id: "t-4", project_id: "p-1", title: "Connect checkout to payments", domain: "Engineering", status: "BLOCKED", risk: 4, reversibility: 2, approval_required: true, description: null, created_at: ago(24 * 2), started_at: null, completed_at: null },
      { id: "t-5", project_id: "p-2", title: "Map the current intake journey", domain: "Strategy", status: "COMPLETED", risk: 1, reversibility: 5, approval_required: false, description: null, created_at: ago(24 * 8), started_at: ago(24 * 8), completed_at: ago(24 * 7) },
      { id: "t-6", project_id: "p-2", title: "Publish the new intake form", domain: "Engineering", status: "WAITING", risk: 4, reversibility: 2, approval_required: true, description: null, created_at: ago(24 * 1), started_at: null, completed_at: null },
      { id: "t-7", project_id: "p-3", title: "Draft the portfolio narrative", domain: "Content", status: "READY", risk: 1, reversibility: 5, approval_required: false, description: null, created_at: ago(24 * 2), started_at: null, completed_at: null },
    ],
    decisions: [
      { id: "d-1", project_id: "p-1", question: "Which design territory should the storefront follow?", options: ["Warm editorial", "Playful modern", "Austere minimal"], recommendation: "Warm editorial", status: "WAITING_FOR_HUMAN", confidence: 0.72, risk: 2, reversibility: 4, rationale: null, selected_option: null, created_at: ago(30), resolved_at: null },
      { id: "d-2", project_id: "p-2", question: "Should intake be one page or a short sequence?", options: ["One page", "Three short steps"], recommendation: "Three short steps", status: "ACCEPTED", confidence: 0.8, risk: 2, reversibility: 4, rationale: "Less cognitive load per screen.", selected_option: "Three short steps", created_at: ago(24 * 6), resolved_at: ago(24 * 5) },
      { id: "d-3", project_id: "p-4", question: "Retire the secondary logo?", options: ["Retire", "Keep"], recommendation: "Retire", status: "ACCEPTED", confidence: 0.9, risk: 1, reversibility: 5, rationale: null, selected_option: "Retire", created_at: ago(24 * 40), resolved_at: ago(24 * 38) },
    ],
    approvals: [
      { id: "a-1", project_id: "p-2", target_type: "TASK", title: "Publish the redesigned intake form to production", reason: "The new three-step intake passed every quality gate and testing on staging. Publishing makes it live to real patients, so it needs a human signature.", recommendation: "Approve, with a 7-day watch on abandonment.", consequences: "Real patients see the new form immediately. Rolling back is possible but patient submissions during the window cannot be un-submitted.", risk: 4, reversibility: 2, requires_client: true, status: "REQUESTED", constraints: null, evidence_request: null, resolution_note: null, resolved_at: null, resolved_by: null, created_at: ago(20) },
      { id: "a-2", project_id: "p-1", target_type: "DECISION", title: "Select the 'Warm editorial' territory for the storefront", reason: "Territory critique kept two of three candidates; 'Warm editorial' is the only one a competitor could not adopt in a weekend.", recommendation: "Select 'Warm editorial'.", consequences: "Locks the visual direction the rest of the build follows. Reversible, at the cost of rework.", risk: 2, reversibility: 4, requires_client: false, status: "REQUESTED", constraints: null, evidence_request: null, resolution_note: null, resolved_at: null, resolved_by: null, created_at: ago(28) },
      { id: "a-3", project_id: "p-3", target_type: "PROJECT", title: "Start the portfolio build", reason: "Scope, budget and timeline are agreed.", recommendation: "Approve.", consequences: "Opens the build phase.", risk: 1, reversibility: 5, requires_client: false, status: "GRANTED", constraints: null, evidence_request: null, resolution_note: null, resolved_at: ago(24 * 2), resolved_by: "u-ceo", created_at: ago(24 * 3) },
      { id: "a-4", project_id: "p-1", target_type: "TASK", title: "Switch the payment provider", reason: "A cheaper provider was proposed mid-build.", recommendation: "Reject: not in the approved scope.", consequences: "Would change fees and the checkout contract.", risk: 4, reversibility: 2, requires_client: true, status: "REJECTED", constraints: null, evidence_request: null, resolution_note: "Out of scope for this phase.", resolved_at: ago(24 * 4), resolved_by: "u-ceo", created_at: ago(24 * 5) },
    ],
    evidence: [
      { id: "e-1", project_id: "p-2", approval_id: "a-1", claim: "All 14 intake form quality gates passed on staging.", source: "quality-gate run #218", source_type: "SYSTEM", confidence: 0.95, created_at: ago(22) },
      { id: "e-2", project_id: "p-2", approval_id: "a-1", claim: "Median completion time fell from 9m 10s to 4m 40s in staging tests.", source: "usability session notes", source_type: "HUMAN", confidence: 0.78, created_at: ago(21) },
      { id: "e-3", project_id: "p-1", approval_id: "a-2", claim: "Two of the three territories failed the Generic Design Detector against current competitors.", source: "territory critique", source_type: "SYSTEM", confidence: 0.82, created_at: ago(29) },
      { id: "e-4", project_id: "p-1", approval_id: null, claim: "Competitor sites in this vertical overwhelmingly use centred hero + stock photography.", source: "competitive snapshot", source_type: "SYSTEM", confidence: 0.7, created_at: ago(24 * 13) },
    ],
    artifacts: [
      { id: "f-1", project_id: "p-1", type: "deliverable", name: "Brand audit summary", description: "What to keep, what to retire.", storage_path: null, status: "FINAL", client_visible: true, created_at: ago(24 * 35) },
      { id: "f-2", project_id: "p-1", type: "deliverable", name: "Territory exploration deck", description: "Three directions, with critique.", storage_path: null, status: "PROPOSED", client_visible: true, created_at: ago(24 * 12) },
      { id: "f-3", project_id: "p-2", type: "deliverable", name: "Intake journey map", description: "Where patients drop off today.", storage_path: null, status: "FINAL", client_visible: true, created_at: ago(24 * 7) },
    ],
    requirements: [
      { id: "r-1", project_id: "p-1", name: "Brand guidelines", description: "The current brand guide and logo files.", category: "general", required: true, status: "RECEIVED", reason: "Needed to keep the redesign consistent.", assigned_to_client: true, deadline: null, resolved_at: ago(24 * 15), response: "Uploaded to the shared folder.", response_file_path: null, created_at: ago(24 * 17) },
      { id: "r-2", project_id: "p-1", name: "Last quarter's order data", description: "A CSV export of online orders.", category: "general", required: true, status: "REQUESTED", reason: "Needed to measure the baseline.", assigned_to_client: true, deadline: null, resolved_at: null, response: null, response_file_path: null, created_at: ago(24 * 2) },
      { id: "r-3", project_id: "p-2", name: "Compliance wording for the intake form", description: "Approved consent and privacy text.", category: "general", required: true, status: "REQUESTED", reason: "Must be present before publishing.", assigned_to_client: true, deadline: null, resolved_at: null, response: null, response_file_path: null, created_at: ago(24 * 3) },
      { id: "r-4", project_id: "p-3", name: "Case-study permissions", description: "Which past projects may be shown.", category: "general", required: false, status: "MISSING", reason: "Internal.", assigned_to_client: false, deadline: null, resolved_at: null, response: null, response_file_path: null, created_at: ago(24 * 4) },
    ],
    outcomes: [
      { id: "o-1", project_id: "p-4", metric: "Brand consistency score", expected_value: "70", actual_value: "84", interpretation: null, created_at: ago(24 * 30) },
    ],
    events: [
      { id: "ev-1", project_id: "p-2", type: "APPROVAL_REQUESTED", summary: "Approval requested: Publish the redesigned intake form to production", actor_id: null, client_visible: true, created_at: ago(20) },
      { id: "ev-2", project_id: "p-1", type: "APPROVAL_REQUESTED", summary: "Approval requested: Select the 'Warm editorial' territory for the storefront", actor_id: null, client_visible: false, created_at: ago(28) },
      { id: "ev-3", project_id: "p-1", type: "TASK_BLOCKED", summary: "Connect checkout to payments is blocked: waiting on provider credentials", actor_id: null, client_visible: false, created_at: ago(26) },
      { id: "ev-4", project_id: "p-1", type: "TASK_STARTED", summary: "Build the storefront composition started", actor_id: null, client_visible: true, created_at: ago(24 * 3) },
      { id: "ev-5", project_id: "p-3", type: "APPROVAL_GRANTED", summary: "CEO approved: Start the portfolio build", actor_id: "u-ceo", client_visible: false, created_at: ago(24 * 2) },
      { id: "ev-6", project_id: "p-1", type: "APPROVAL_REJECTED", summary: "CEO rejected: Switch the payment provider", actor_id: "u-ceo", client_visible: true, created_at: ago(24 * 4) },
      { id: "ev-7", project_id: "p-2", type: "DECISION_RECORDED", summary: "Decision recorded: three short steps for intake", actor_id: "u-ceo", client_visible: true, created_at: ago(24 * 5) },
      { id: "ev-8", project_id: "p-2", type: "DELIVERABLE_SHARED", summary: "Deliverable: Intake journey map", actor_id: "u-ceo", client_visible: true, created_at: ago(24 * 7) },
      { id: "ev-9", project_id: "p-1", type: "CONTEXT_RECEIVED", summary: "Client provided: Brand guidelines", actor_id: "u-amara", client_visible: true, created_at: ago(24 * 15) },
      { id: "ev-10", project_id: "p-4", type: "PROJECT_COMPLETED", summary: "Project completed: Northwind brand audit", actor_id: null, client_visible: true, created_at: ago(24 * 35) },
      { id: "ev-11", project_id: "p-3", type: "PROJECT_CREATED", summary: "Project opened: Portfolio v2", actor_id: "u-ceo", client_visible: false, created_at: ago(24 * 5) },
    ],
    intents: [
      { id: "in-1", organization_id: "o-1", project_id: "p-1", source: "CLIENT_INTENT", status: "UNDERSTOOD", text: "Clarify our Q4 priorities and drop anything that does not move online orders.", initiator_id: "u-amara", rejection_reason: null, created_at: ago(24 * 20), understood_at: ago(24 * 20), questions: [], assumptions: [{ id: "as-1", question: "Is there a spending limit we should respect?", assumed: "Use the usual range for this kind of work", forced: false }], answers: [], materials: [] },
      { id: "in-2", organization_id: "o-2", project_id: null, source: "CLIENT_INTENT", status: "CLARIFYING", text: "Make the patient intake feel calm.", initiator_id: "u-tunde", rejection_reason: null, created_at: ago(5), understood_at: null,
        questions: [{ id: "q-1", question: "What result would tell you this worked?", why: "Without a result to aim at we cannot tell a good plan from a merely busy one.", decision: "Which approach we propose, and how we measure success.", options: [{ id: "revenue", label: "More completed intakes", tradeoff: "We design around completion; extras that do not help it are left out." }, { id: "trust", label: "Patients who feel at ease", tradeoff: "We invest in tone and content; it is slower to measure." }], default_option_id: null }],
        assumptions: [], answers: [],
        materials: [{ requirement_id: "m-1", name: "Brand guidelines", why: "Design should extend your brand, not invent a new one.", if_missing: "Colors, type and tone would be guessed.", required: true, ways: ["UPLOAD", "LINK", "NONE", "SOURCE"], sourcing: false }] },
    ],
    organizations: [
      { id: "o-1", name: "Northwind Bakery", mission: "Fresh bread, honestly made.", created_at: ago(24 * 70) },
      { id: "o-2", name: "Lumen Health", mission: "Care that feels unhurried.", created_at: ago(24 * 50) },
      { id: "o-3", name: "DevPlaybook (internal)", mission: "The agency's own work.", created_at: ago(24 * 90) },
    ],
    clients,
  };
  const plans: PlanVersion[] = [{
    id: "pl-1", project_id: "p-1", organization_id: "o-1", version: 1, status: "SUBMITTED", decision_owner: "CLIENT_OWNER", impact: 3, reversibility: 3, rationale: null,
    submitted_at: ago(24 * 19), decided_at: null, decision: null, decision_note: null, on_behalf: false, plan: demoPlan(),
  }];
  // Lumen's onboarding work has used up the budget they approved, so it stopped and is asking Tunde whether to allow more.
  const runs: RunView[] = [{
    id: "r-2", project_id: "p-2", status: "WAITING", wait_reason: "BUDGET_EXCEEDED", plan_version: 1, close_reason: null, started_at: ago(24 * 6), ended_at: null,
    tasks: [
      { id: "r2-a", plan_task_id: "t1", title: "Map the current intake journey", domain: "Strategy", status: "COMPLETED", wait_reason: null, depends_on: [], stale: false },
      { id: "r2-b", plan_task_id: "t2", title: "Design the calmer intake form", domain: "Design", status: "COMPLETED", wait_reason: null, depends_on: ["t1"], stale: false },
      { id: "r2-c", plan_task_id: "t3", title: "Publish the new intake form", domain: "Engineering", status: "WAITING", wait_reason: "BUDGET_EXCEEDED", depends_on: ["t2"], stale: false },
      { id: "r2-d", plan_task_id: "t4", title: "Measure abandonment for two weeks", domain: "Strategy", status: "PENDING", wait_reason: null, depends_on: ["t3"], stale: false },
    ],
  }];
  const questions: Question[] = [{
    id: "q-1", project_id: "p-2", organization_id: "o-2", run_id: "r-2", task_id: "r2-c", reason: "BUDGET_EXCEEDED", routed_to: "CLIENT_OWNER", status: "OPEN",
    title: "The budget has been reached", summary: "The work has reached the budget that was approved ($1.50). Nothing more has been spent. You can allow more, or stop here.",
    detail: "Publish the new intake form: this would take the run past the budget the client approved.", options: [{ id: "RAISE_BUDGET", stepUp: true }, { id: "STOP_RUN", stepUp: false }],
    recommendation: { option: "RAISE_BUDGET", why: "Raising the limit to $1.88 lets the plan finish." }, deadline: ago(-24 * 3), created_at: ago(5),
  }];
  const budgets: Record<string, BudgetView> = { "p-2": { run_id: "r-2", run_status: "WAITING", approved_usd: 1.5, used_usd: 1.5, used_percent: 100 } };
  const sec = (position: number, section: string, text: string, sources: BriefDoc["statements"][number]["sources"]): BriefDoc["statements"][number] => ({ position, section, kind: sources.length ? "FACT" : "GAP", text, sources });
  const briefs: BriefDoc[] = [{
    id: "b-1", organization_id: "o-2", project_id: "p-2", type: "EXCEPTION", audience: "CLIENT", title: "Lumen onboarding: the budget has been reached", level: 4, created_at: ago(5),
    statements: [
      sec(0, "What happened", "The work reached the $1.50 budget you approved.", [{ type: "Run", ids: ["r-2"], path: "budget.approvedUsd", expect: 1.5, sum: false }]),
      sec(1, "What happened", "$1.50 has been spent in total.", [{ type: "Cost record", ids: ["c-1", "c-2", "c-3"], path: "costUsd", expect: 1.5, sum: true }]),
      sec(2, "What happens next", "Nothing more will be spent until you answer. You can allow more, or stop here.", [{ type: "Question", ids: ["q-1"], path: "status", expect: "OPEN", sum: false }]),
      sec(3, "What it cost to get here", "The reason the last step cost more than planned: not recorded.", []),
    ],
  }, {
    id: "b-2", organization_id: "o-1", project_id: "p-1", type: "KICKOFF", audience: "CLIENT", title: "Northwind checkout: what we will do", level: 2, created_at: ago(24 * 19),
    statements: [
      sec(0, "The plan", "We will clarify Q4 priorities and drop what does not move online orders.", [{ type: "Plan", ids: ["pl-1"], path: "objective", expect: "Clarify Q4 priorities", sum: false }]),
      sec(1, "The plan", "The work is estimated at $4 to $9.", [{ type: "Plan", ids: ["pl-1"], path: "budget.highUsd", expect: 9, sum: false }]),
      sec(2, "The plan", "When it will be finished: not recorded.", []),
    ],
  }];
  const prefs: Record<string, NotificationPrefs> = {};
  const notifications: NotificationItem[] = [
    { id: "n-1", brief_id: "b-1", title: "Lumen onboarding: the budget has been reached", type: "EXCEPTION", project_id: "p-2", level: 4, status: "SENT", reason: null, created_at: ago(5) },
    { id: "n-2", brief_id: "b-2", title: "Northwind checkout: what we will do", type: "KICKOFF", project_id: "p-1", level: 2, status: "WAITING_DIGEST", reason: "WAITS_FOR_DIGEST", created_at: ago(24 * 19) },
  ];
  return { data, users, assets: [], lastSeen: ago(24 * 2), plans, decisions: [], delegations: [], runs, questions, budgets, briefs, prefs, notifications,
    links: [{ token: "demo-redo", view: { state: "READY", option: "REWORK", label: "Redo the step", does: "The step is done again from the start, within the budget already approved.", title: "A quality check did not pass", summary: "A step's result did not meet the quality bar. It can be redone.", project: "Lumen onboarding", expires_at: ago(-24 * 3) } }] };
}

/** Can the signed-in person see this project's work? The CEO reaches all of it; a client only their own organization's. */
function mayReach(s: Store, projectId: string): boolean {
  const uid = typeof window === "undefined" ? null : window.localStorage.getItem(SESSION_KEY);
  const me = s.users.find((u) => u.id === uid);
  if (!me) return false;
  if (me.role === "owner") return true;
  const project = s.data.projects.find((p) => p.id === projectId);
  return Boolean(project && me.memberships.some((m) => m.organizationId === project.organization_id));
}

const DEFAULT_PREFS: NotificationPrefs = { timezone: "UTC", quiet_hours: null, min_interrupt_level: 3, email_enabled: true, digest: { frequency: "DAILY", time: "08:00", weekday: 1 } };

/** Can the signed-in person read this brief? The CEO reads all; a client only what was written to their own organization. */
function mayReadBrief(s: Store, b: { organization_id: string; audience: string }): boolean {
  const uid = typeof window === "undefined" ? null : window.localStorage.getItem(SESSION_KEY);
  const me = s.users.find((u) => u.id === uid);
  if (!me) return false;
  if (me.role === "owner") return true;
  return b.audience === "CLIENT" && me.memberships.some((m) => m.organizationId === b.organization_id);
}

/** The work ends here: the run and what was unfinished are cancelled, and the project is stopped. */
function endRunFixture(s: Store, run: RunView) {
  run.status = "CANCELLED"; run.wait_reason = null; run.ended_at = new Date().toISOString(); run.close_reason = "STOPPED_BY_OWNER";
  run.tasks.forEach((t) => { if (!["COMPLETED", "FAILED", "CANCELLED"].includes(t.status)) { t.status = "CANCELLED"; t.wait_reason = null; } });
  const project = s.data.projects.find((p) => p.id === run.project_id);
  if (project) { project.status = "CANCELLED"; project.wait_reason = null; }
  s.questions = s.questions.filter((q) => q.run_id !== run.id);
  if (s.budgets[run.project_id]) s.budgets[run.project_id]!.run_status = "CANCELLED";
}

/** What answering a question does, in the demo: the work goes on or ends, and the question is closed. */
function applyAnswer(s: Store, q: Question, answer: Answer) {
  if (!q.options.some((o) => o.id === answer.option)) throw new Error("That is not one of the answers offered.");
  const run = s.runs.find((r) => r.id === q.run_id);
  if (!run) throw new Error("This was already answered.");
  if (answer.option === "STOP_RUN") { endRunFixture(s, run); return; }
  if (answer.option === "RAISE_BUDGET") {
    const b = s.budgets[q.project_id];
    if (!answer.toUsd || !b || answer.toUsd <= (b.approved_usd ?? 0)) throw new Error("Something needed for that answer is missing or not valid.");
    b.approved_usd = answer.toUsd; b.used_percent = Math.round((b.used_usd / answer.toUsd) * 1000) / 10;
  }
  if (answer.option === "ACCEPT_RISK" && !answer.note?.trim()) throw new Error("Something needed for that answer is missing or not valid.");
  run.status = "RUNNING"; run.wait_reason = null;
  run.tasks.forEach((t) => { if (t.status === "WAITING" && t.id === q.task_id) { t.status = "READY"; t.wait_reason = null; } });
  const project = s.data.projects.find((p) => p.id === q.project_id);
  if (project && ["WAITING", "PAUSED"].includes(project.status)) { project.status = "ACTIVE"; project.wait_reason = null; }
  if (s.budgets[q.project_id]) s.budgets[q.project_id]!.run_status = "RUNNING";
  s.questions = s.questions.filter((x) => x.id !== q.id);
}

function load(): Store {
  if (typeof window === "undefined") return seed();
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* fall through to a fresh seed */
  }
  const fresh = seed();
  save(fresh);
  return fresh;
}

function save(s: Store) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: the demo still works for this page view */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const toSession = (u: User): Session => ({ userId: u.id, email: u.email, displayName: u.displayName, role: u.role, memberships: u.memberships });

/** What `GET /v1/domains` serves, for the demo. The only list of domains in this repo; the real one comes from the API (ADR-0017). */
const DEMO_DEPARTMENTS: Record<string, string> = {
  STRATEGY_INTELLIGENCE: "Strategy & Intelligence", BRAND_CREATIVE: "Brand & Creative", PRODUCT_ENGINEERING: "Product & Engineering",
  GROWTH_COMMUNICATIONS: "Growth & Communications", EVIDENCE_ASSURANCE: "Evidence & Assurance",
};
const DEMO_DOMAINS: DomainView[] = ([
  ["STRATEGY", "Strategy", "advisory-standin", "STRATEGY_INTELLIGENCE"], ["MARKET", "Market", "advisory-standin", "STRATEGY_INTELLIGENCE"],
  ["BUSINESS", "Business", "advisory-standin", "STRATEGY_INTELLIGENCE"], ["BRAND", "Brand", "contract", "BRAND_CREATIVE"],
  ["DESIGN", "Design", "contract", "BRAND_CREATIVE"], ["CONTENT", "Content", "advisory-standin", "BRAND_CREATIVE"],
  ["MEDIA", "Media", "advisory-standin", "BRAND_CREATIVE"], ["PRODUCT", "Product", "advisory-standin", "PRODUCT_ENGINEERING"],
  ["ENGINEERING", "Engineering", "advisory-standin", "PRODUCT_ENGINEERING"], ["GROWTH", "Growth", "advisory-standin", "GROWTH_COMMUNICATIONS"],
  ["COMMUNICATIONS", "Communications", "advisory-standin", "GROWTH_COMMUNICATIONS"], ["MEASUREMENT", "Measurement", "advisory-standin", "EVIDENCE_ASSURANCE"],
  ["COMPLIANCE", "Compliance", "advisory-standin", "EVIDENCE_ASSURANCE"],
] as const).map(([code, name, basis, department]) => ({
  code, name, department: { code: department, name: DEMO_DEPARTMENTS[department]! },
  pack: { version: "0.1.0", basis, contract: null, stages: ["plan"], implementation: { "implemented-and-tested": 0, partial: 0, missing: 0 } },
}));

const DEMO_CODE = "123456";

export function createFixturesDataSource(): DataSource {
  let steppedUp = false;
  const signIn = (u: User): Result<Session> => {
    window.localStorage.setItem(SESSION_KEY, u.id);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return ok(toSession(u));
  };
  const mutate = (fn: (s: Store) => void): Result => {
    const s = load();
    try { fn(s); } catch (e) { return fail((e as Error).message); }
    save(s);
    return ok(undefined as void);
  };
  const addEvent = (s: Store, e: Omit<V4Event, "id" | "created_at" | "actor_id"> & { actor_id?: string | null }) => {
    s.data.events.unshift({ id: id(), created_at: new Date().toISOString(), actor_id: e.actor_id ?? currentUserId(), ...e });
  };
  const currentUserId = () => (typeof window === "undefined" ? null : window.localStorage.getItem(SESSION_KEY));
  const approvalById = (s: Store, aid: string): Approval | undefined => s.data.approvals.find((a) => a.id === aid);

  return {
    kind: "fixtures",
    capabilities: { approvalNotes: true, timelineUpdates: true, designDocuments: true },

    auth: {
      async getSession() {
        const uid = currentUserId();
        if (!uid) return null;
        const u = load().users.find((x) => x.id === uid);
        return u ? toSession(u) : null;
      },
      async requestSignIn(email) {
        if (!email.includes("@")) return fail("That doesn't look like an email address.", "INVALID_EMAIL");
        return ok(undefined as void); // like the real thing: the answer never reveals whether the address has an account
      },
      async verifyLink(token) {
        const u = load().users.find((x) => x.id === token);
        if (!u) return fail("That link or code has expired or was already used. Ask for a new one.", "INVALID_OR_EXPIRED");
        return signIn(u);
      },
      async verifyCode(email, code) {
        const u = load().users.find((x) => x.email === email.trim().toLowerCase());
        if (!u || code !== DEMO_CODE) return fail("That link or code has expired or was already used. Ask for a new one.", "INVALID_OR_EXPIRED");
        return signIn(u);
      },
      async acceptInvitation(token) {
        const u = load().users.find((x) => x.id === token);
        return u ? signIn(u) : fail("That link or code has expired or was already used. Ask for a new one.", "INVALID_OR_EXPIRED");
      },
      async requestStepUp() {
        return ok(undefined as void);
      },
      async verifyStepUp(code) {
        if (code !== DEMO_CODE) return fail("That link or code has expired or was already used. Ask for a new one.", "INVALID_OR_EXPIRED");
        steppedUp = true;
        return ok(undefined as void);
      },
      async signOut() {
        window.localStorage.removeItem(SESSION_KEY);
        window.dispatchEvent(new Event(CHANGE_EVENT));
      },
      subscribe(onChange) {
        const h = () => onChange();
        window.addEventListener(CHANGE_EVENT, h);
        window.addEventListener("storage", h);
        return () => {
          window.removeEventListener(CHANGE_EVENT, h);
          window.removeEventListener("storage", h);
        };
      },
    },

    queries: {
      async ownerData() {
        return structuredClone(load().data);
      },
      async domains() {
        return structuredClone(DEMO_DOMAINS);
      },
      async clientData(): Promise<ClientData> {
        const s = load();
        const uid = currentUserId();
        const orgs = new Set((s.users.find((u) => u.id === uid)?.memberships ?? []).map((m) => m.organizationId));
        const mine = new Set(s.data.projects.filter((p) => p.organization_id && orgs.has(p.organization_id)).map((p) => p.id));
        return structuredClone({
          projects: s.data.projects.filter((p) => mine.has(p.id)),
          events: s.data.events.filter((e) => e.client_visible && e.project_id && mine.has(e.project_id)),
          artifacts: s.data.artifacts.filter((a) => a.client_visible && mine.has(a.project_id)),
          approvals: s.data.approvals.filter((a) => a.requires_client && mine.has(a.project_id)),
          requirements: s.data.requirements.filter((r) => r.assigned_to_client && mine.has(r.project_id)),
          intents: s.data.intents.filter((i) => orgs.has(i.organization_id)),
        });
      },
    },

    commands: {
      async resolveApproval(aid, approved) {
        return mutate((s) => {
          const a = approvalById(s, aid);
          if (!a) return;
          a.status = approved ? "GRANTED" : "REJECTED";
          a.resolved_by = currentUserId();
          a.resolved_at = new Date().toISOString();
          addEvent(s, { project_id: a.project_id, type: approved ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED", summary: `CEO ${approved ? "approved" : "rejected"}: ${a.title}`, client_visible: a.requires_client });
        });
      },
      async setApprovalConstraints(aid, text) {
        return mutate((s) => {
          const a = approvalById(s, aid);
          if (!a) return;
          a.constraints = text;
          addEvent(s, { project_id: a.project_id, type: "APPROVAL_UPDATED", summary: `Constraints set on: ${a.title}`, client_visible: a.requires_client });
        });
      },
      async requestApprovalEvidence(aid, text) {
        return mutate((s) => {
          const a = approvalById(s, aid);
          if (!a) return;
          a.evidence_request = text;
          addEvent(s, { project_id: a.project_id, type: "APPROVAL_UPDATED", summary: `Evidence requested on: ${a.title}`, client_visible: a.requires_client });
        });
      },
      async clientResolveApproval(aid, approved, note) {
        return mutate((s) => {
          const a = approvalById(s, aid);
          if (!a || !a.requires_client || a.status !== "REQUESTED") return;
          a.status = approved ? "GRANTED" : "REJECTED";
          a.resolution_note = note.slice(0, 2000);
          a.resolved_by = currentUserId();
          a.resolved_at = new Date().toISOString();
          addEvent(s, { project_id: a.project_id, type: approved ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED", summary: `Client ${approved ? "approved" : "rejected"}: ${a.title}`, client_visible: true });
        });
      },

      async markSeen() {
        const s = load();
        const prev = s.lastSeen;
        s.lastSeen = new Date().toISOString();
        save(s);
        return prev;
      },

      async createOrganization(input) {
        return mutate((s) => {
          s.data.organizations.push({ id: id(), name: input.name, mission: input.mission, created_at: new Date().toISOString() });
        });
      },
      async invitePerson(input) {
        if (!steppedUp) return fail("For safety, please confirm it's you first.", "STEP_UP_REQUIRED");
        const s = load();
        const email = input.email.trim().toLowerCase();
        if (!email.includes("@")) return fail("That doesn't look like an email address.", "INVALID_EMAIL");
        let u = s.users.find((x) => x.email === email);
        if (u?.role === "owner") return fail("That email belongs to the owner account.");
        if (!u) {
          u = { id: id(), email, displayName: email.split("@")[0] ?? email, role: "client", memberships: [] };
          s.users.push(u);
          s.data.clients.push({ id: u.id, email, display_name: u.displayName, created_at: new Date().toISOString(), memberships: [] });
        }
        if (!u.memberships.some((m) => m.organizationId === input.organizationId)) u.memberships.push({ organizationId: input.organizationId, role: input.role });
        const c = s.data.clients.find((x) => x.id === u!.id);
        if (c && !c.memberships.some((m) => m.organization_id === input.organizationId)) c.memberships.push({ organization_id: input.organizationId, role: input.role });
        save(s);
        return ok(undefined as void);
      },
      async removePerson(organizationId, userId) {
        return mutate((s) => {
          const u = s.users.find((x) => x.id === userId);
          if (u) u.memberships = u.memberships.filter((m) => m.organizationId !== organizationId);
          const c = s.data.clients.find((x) => x.id === userId);
          if (c) c.memberships = c.memberships.filter((m) => m.organization_id !== organizationId);
        });
      },
      async postUpdate(projectId, input) {
        return mutate((s) => {
          addEvent(s, { project_id: projectId, type: "UPDATE", summary: input.summary, client_visible: input.share });
        });
      },

    },

    intents: {
      async submit(input) {
        const words = input.text.trim().split(/\s+/).length;
        const clear = words >= 12;
        const s = load();
        const id_ = id();
        s.data.intents.unshift({
          id: id_, organization_id: input.organizationId, project_id: null, source: currentUserId() === "u-ceo" ? "CEO_DIRECTIVE" : "CLIENT_INTENT", status: clear ? "PLANNED" : "CLARIFYING",
          text: input.text.trim(), initiator_id: currentUserId() ?? "u-ceo", rejection_reason: null, created_at: new Date().toISOString(), understood_at: clear ? new Date().toISOString() : null,
          questions: clear ? [] : [{ id: id(), question: "What result would tell you this worked?", why: "Without a result to aim at we cannot tell a good plan from a merely busy one.", decision: "Which approach we propose, and how we measure success.", options: [{ id: "revenue", label: "More sales or sign-ups", tradeoff: "We design around conversion." }, { id: "trust", label: "More trust and a clearer image", tradeoff: "Slower to measure." }], default_option_id: null }],
          assumptions: [], answers: [], materials: [],
        });
        if (clear) {
          const pid = id();
          s.data.projects.unshift({ id: pid, organization_id: input.organizationId, name: input.text.trim().slice(0, 60), description: input.text.trim(), objective: null, status: "INTAKE", priority: 50, domains: [], created_at: new Date().toISOString(), started_at: null, completed_at: null });
          s.data.intents[0]!.project_id = pid;
        }
        save(s);
        return ok({ status: clear ? "PLANNED" : "CLARIFYING", projectId: s.data.intents[0]!.project_id });
      },
      async answer(intentId, clarificationId, answer) {
        return mutate((s) => {
          const i = s.data.intents.find((x) => x.id === intentId);
          const q = i?.questions.find((x) => x.id === clarificationId);
          if (!i || !q) return;
          i.answers.push({ id: q.id, question: q.question, answer: answer.text ?? q.options.find((o) => o.id === answer.optionId)?.label ?? "our usual choice" });
          i.questions = i.questions.filter((x) => x.id !== clarificationId);
          if (i.questions.length === 0) { i.status = "PLANNED"; i.understood_at = new Date().toISOString(); }
        });
      },
      async respond(requirementId) {
        return mutate((s) => { for (const i of s.data.intents) i.materials = i.materials.filter((m) => m.requirement_id !== requirementId); });
      },
      async clientView(intentId) {
        const s = load();
        const i = s.data.intents.find((x) => x.id === intentId);
        if (!i) return fail("That request couldn't be found.", "NOT_FOUND");
        const plan = i.project_id ? [...s.plans].filter((p) => p.project_id === i.project_id && p.status !== "DRAFT").sort((a, b) => b.version - a.version)[0] : undefined;
        const need = (m: (typeof i.materials)[number]) => ({ requirement_id: m.requirement_id, name: m.name, why: m.why, if_missing: m.if_missing, ways: m.ways, sourcing: m.sourcing });
        return ok({
          id: i.id, text: i.text, created_at: i.created_at, status: STATUS_LINE(i, Boolean(plan)),
          questions: i.questions.map((q, n) => ({ id: q.id, position: n + 1, of: i.questions.length, question: q.question, why: q.why, options: q.options, default_option_id: q.default_option_id })),
          needs: { required: i.materials.filter((m) => m.required).map(need), optional: i.materials.filter((m) => !m.required).map(need) },
          assumed: i.assumptions.map((a) => ({ id: a.id, question: a.question, answer: a.assumed })),
          plan: plan ? { id: plan.id, version: plan.version, status: plan.status } : null,
        });
      },
    },

    actionLinks: {
      async describe(token) {
        const l = load().links.find((x) => x.token === token);
        return l ? ok(structuredClone(l.view)) : fail("That link isn't valid.", "INVALID_OR_EXPIRED");
      },
      async confirm(token) {
        const s = load();
        const l = s.links.find((x) => x.token === token);
        if (!l) return fail("That link isn't valid.", "INVALID_OR_EXPIRED");
        if (l.view.state === "EXPIRED") return fail("This link has expired.", "EXPIRED");
        if (l.view.state !== "READY") return fail("This link has already been used.", "ALREADY_USED");
        l.view.state = "USED";
        save(s);
        return ok({ option: l.view.option });
      },
    },

    briefs: {
      async list(opts) {
        const s = load();
        return ok(structuredClone(s.briefs.filter((b) => (!opts?.projectId || b.project_id === opts.projectId) && (!opts?.type || b.type === opts.type) && mayReadBrief(s, b))
          .map(({ statements: _statements, ...b }) => b).sort((a, b) => b.created_at.localeCompare(a.created_at))));
      },
      async get(id) {
        const s = load();
        const b = s.briefs.find((x) => x.id === id);
        return b && mayReadBrief(s, b) ? ok(structuredClone(b)) : fail("That couldn't be found.", "NOT_FOUND");
      },
      async verify(id) {
        const s = load();
        const b = s.briefs.find((x) => x.id === id);
        if (!b || !mayReadBrief(s, b)) return fail("That couldn't be found.", "NOT_FOUND");
        const facts = b.statements.filter((x) => x.kind === "FACT").length;
        return ok({ ok: true, facts, gaps: b.statements.length - facts, problems: [] });
      },
    },

    notifications: {
      async list() {
        const s = load();
        return ok(structuredClone(s.notifications.filter((n) => { const b = s.briefs.find((x) => x.id === n.brief_id); return b ? mayReadBrief(s, b) : false; })));
      },
      async preferences() {
        const s = load();
        const uid = currentUserId();
        return ok(structuredClone((uid && s.prefs[uid]) || { ...DEFAULT_PREFS }));
      },
      async savePreferences(p) {
        if (p.min_interrupt_level < 3 || p.min_interrupt_level > 5) return fail("Only level 3 and above can interrupt.");
        if (p.quiet_hours && p.quiet_hours.start === p.quiet_hours.end) return fail("Quiet hours need a start and a different end.");
        const r = mutate((s) => { const uid = currentUserId(); if (uid) s.prefs[uid] = structuredClone(p); });
        return r.error ? { data: null, error: r.error } : ok(structuredClone(p));
      },
    },

    design: {
      async load(projectId) { return ok(loadDraft(projectId)); },
      async save(doc, baseRevision) {
        const stored = loadDraft(doc.projectId);
        if (stored && stored.revision !== baseRevision) return fail("Someone else saved a newer version. Reload to see it.", "REVISION_CONFLICT");
        return saveDraft(doc) ? ok({ revision: doc.revision }) : fail("This browser could not keep the design. Export it to be safe.", "STORAGE_FULL");
      },
    },

    runs: {
      async list(projectId) {
        const s = load();
        return ok(structuredClone(s.runs.filter((r) => r.project_id === projectId && mayReach(s, projectId)).sort((a, b) => b.started_at.localeCompare(a.started_at))));
      },
      async budget(projectId) {
        const s = load();
        return ok(mayReach(s, projectId) ? structuredClone(s.budgets[projectId] ?? null) : null);
      },
      async pause(projectId, note) {
        return mutate((s) => {
          const run = s.runs.find((r) => r.project_id === projectId && r.status === "RUNNING");
          if (!run) throw new Error(s.runs.some((r) => r.project_id === projectId && r.status === "PAUSED") ? "The work is already paused." : "There is nothing running to pause.");
          const by = currentUserId() === "u-ceo" && s.users.find((u) => u.id === currentUserId())?.role === "owner" ? "the agency" : "the project's owner";
          run.status = "PAUSED";
          const project = s.data.projects.find((p) => p.id === projectId);
          if (project) project.status = "PAUSED";
          s.questions.push({
            id: id(), project_id: projectId, organization_id: project?.organization_id ?? "", run_id: run.id, task_id: null, reason: "PAUSED_BY_OWNER",
            routed_to: by === "the agency" ? "CEO" : "CLIENT_OWNER", status: "OPEN", title: "The work is paused",
            summary: `The work was paused by ${by}${note ? `: ${note}` : ""}. Work already under way was allowed to finish; nothing new has started and nothing will until it is resumed.`,
            detail: null, options: [{ id: "RESUME", stepUp: false }, { id: "STOP_RUN", stepUp: false }], recommendation: null, deadline: null, created_at: new Date().toISOString(),
          });
        });
      },
      async resume(projectId) {
        return mutate((s) => {
          const q = s.questions.find((x) => x.project_id === projectId && x.reason === "PAUSED_BY_OWNER");
          if (!q) throw new Error("The work is not paused.");
          applyAnswer(s, q, { option: "RESUME" });
        });
      },
      async cancel(projectId) {
        return mutate((s) => {
          const run = s.runs.find((r) => r.project_id === projectId && ["RUNNING", "WAITING", "PAUSED"].includes(r.status));
          if (!run) throw new Error("There is no work under way to do that to.");
          endRunFixture(s, run);
        });
      },
    },

    questions: {
      async list(opts) {
        const s = load();
        const me = s.users.find((u) => u.id === currentUserId());
        const agency = me?.role === "owner";
        const mine = s.questions.filter((q) => (!opts?.projectId || q.project_id === opts.projectId) && mayReach(s, q.project_id) && (agency || q.routed_to === "CLIENT_OWNER" || q.reason === "PAUSED_BY_OWNER"));
        return ok(structuredClone(mine).map((q) => (agency ? q : { ...q, detail: null })));
      },
      async answer(questionId, answer) {
        // As the API does: an answer the question marks as needing a fresh proof is refused until the person has given one.
        const offered = load().questions.find((x) => x.id === questionId)?.options.find((o) => o.id === answer.option);
        if (offered?.stepUp && !steppedUp) return fail("For safety, please confirm it's you first.", "STEP_UP_REQUIRED");
        return mutate((s) => {
          const q = s.questions.find((x) => x.id === questionId);
          if (!q) throw new Error("This was already answered.");
          applyAnswer(s, q, answer);
        });
      },
    },

    audit: {
      async chain(organizationId) {
        const s = load();
        const me = s.users.find((u) => u.id === currentUserId());
        if (!me || (me.role !== "owner" && !me.memberships.some((m) => m.organizationId === organizationId))) return fail("That couldn't be found.", "NOT_FOUND");
        // The demo seals what it has recorded: each decision and each delegation, in order.
        const entries = s.delegations.filter((d) => d.organization_id === organizationId).map((d, i) => ({ sequence: i + 1, kind: "delegation.granted", subject_type: "DELEGATION", actor_id: me.id, created_at: d.created_at }));
        return ok({ ok: true, broken_at: null, reason: null, entries });
      },
    },

    standing: {
      async list(organizationId) {
        const s = load();
        const me = s.users.find((u) => u.id === currentUserId());
        if (!me || (me.role !== "owner" && !me.memberships.some((m) => m.organizationId === organizationId))) return fail("That couldn't be found.", "NOT_FOUND");
        return ok(structuredClone(s.delegations.filter((d) => d.basis === "STANDING_POLICY" && d.organization_id === organizationId)));
      },
      async grant(input) {
        const s = load();
        const me = s.users.find((u) => u.id === currentUserId());
        const isOwner = me?.memberships.some((m) => m.organizationId === input.organizationId && m.role === "CLIENT_OWNER");
        // The CEO grants one directly for the agency's own work; for a client it is the client's decision, so only under their permission (the demo has none).
        const agencyOwn = me?.role === "owner" && input.organizationId === "o-3";
        if (me?.role === "owner" && !agencyOwn) return fail("This is the client's decision. You can make it only if their owner has given you permission.", "PERMISSION_REQUIRED");
        if (!isOwner && !agencyOwn) return fail("You don't have access to do that.", "FORBIDDEN");
        if (!steppedUp) return fail("For safety, please confirm it's you first.", "STEP_UP_REQUIRED");
        if (!input.scopes.length || input.validDays < 1 || input.validDays > 90) return fail("Something needed for that is missing or not valid.", "INVALID_PROPOSAL");
        const now = new Date();
        for (const d of s.delegations) if (d.basis === "STANDING_POLICY" && d.organization_id === input.organizationId && !d.revoked_at) { d.revoked_at = now.toISOString(); d.revoked_reason = "Replaced by a new standing policy"; }
        const made: DelegationView = {
          id: id(), basis: "STANDING_POLICY", organization_id: input.organizationId, proposal_id: null, project_id: null, expires_at: new Date(now.getTime() + input.validDays * 864e5).toISOString(),
          approval_level: "L1", max_autonomy_mode: 3, scopes: input.scopes, max_risk: 3, budget_max_usd: null, on_behalf: false, created_at: now.toISOString(), revoked_at: null, revoked_reason: null,
        };
        s.delegations.push(made);
        save(s);
        return ok(structuredClone(made));
      },
    },

    plans: {
      async list(projectId) {
        const s = load();
        const me = s.users.find((u) => u.id === currentUserId());
        return ok(structuredClone(s.plans.filter((p) => p.project_id === projectId && (me?.role === "owner" || p.status !== "DRAFT"))));
      },
      async changes(proposalId) {
        const s = load();
        const to = s.plans.find((p) => p.id === proposalId);
        const from = to && s.plans.find((p) => p.project_id === to.project_id && p.version === to.version - 1);
        if (!to || !from) return fail("There is no earlier version.", "NO_EARLIER_VERSION");
        const usd = (n: number) => `$${n.toFixed(2)}`;
        const summary: string[] = [];
        const b = from.plan.budget, c = to.plan.budget;
        if (b.low_usd !== c.low_usd || b.high_usd !== c.high_usd) summary.push(`Budget: ${usd(b.low_usd)} to ${usd(b.high_usd)} became ${usd(c.low_usd)} to ${usd(c.high_usd)}`);
        for (const t of to.plan.tasks) { const old = from.plan.tasks.find((x) => x.id === t.id); if (old && old.rigor !== t.rigor) summary.push(`Task "${t.title}": rigor "${old.rigor}" became "${t.rigor}"`); }
        for (const a of to.plan.assumptions) if (!from.plan.assumptions.includes(a)) summary.push(`New assumption: ${a}`);
        return ok({ from_version: from.version, to_version: to.version, summary, unchanged: summary.length === 0, budget: b.low_usd !== c.low_usd || b.high_usd !== c.high_usd ? { from_low: b.low_usd, from_high: b.high_usd, to_low: c.low_usd, to_high: c.high_usd } : null });
      },
      async decide(proposalId, decision) {
        const s = load();
        const p = s.plans.find((x) => x.id === proposalId);
        const me = s.users.find((u) => u.id === currentUserId());
        if (!p || !me) return fail("That couldn't be found.", "NOT_FOUND");
        const isOwner = me.memberships.some((m) => m.organizationId === p.organization_id && m.role === "CLIENT_OWNER");
        if (p.decision_owner === "CEO" ? me.role !== "owner" : !isOwner) return fail("This is the client's decision. You can make it only if their owner has given you permission.", "PERMISSION_REQUIRED");
        // Approving commits the client's money, so it needs a fresh proof of who is deciding, as the real API does.
        if (decision.action === "APPROVE" && !steppedUp) return fail("For safety, please confirm it's you first.", "STEP_UP_REQUIRED");
        if (p.status !== "SUBMITTED") return fail("This was already decided.", "ALREADY_DECIDED");
        if (decision.action === "REQUEST_REVISION" && !decision.note?.trim()) return fail("Say what you would like changed.", "INVALID_PROPOSAL");
        const now = new Date().toISOString();
        p.decided_at = now; p.decision_note = decision.note?.trim() || null;
        p.decision = decision.action === "APPROVE" ? "APPROVED" : decision.action === "REJECT" ? "REJECTED" : "REVISION_REQUESTED";
        p.status = p.decision;
        s.decisions.push({ proposal_id: p.id, version: p.version, decision: p.decision, decided_by_role: me.role === "owner" ? "CEO" : "CLIENT_OWNER", on_behalf: false, note: p.decision_note, decided_at: now });
        let nextVersion: number | null = null;
        if (decision.action === "APPROVE") {
          const project = s.data.projects.find((x) => x.id === p.project_id); if (project) project.status = "ACTIVE";
          s.delegations.push({ id: id(), basis: "PLAN_APPROVAL", organization_id: p.organization_id, project_id: p.project_id, expires_at: null, proposal_id: p.id, approval_level: "L1", max_autonomy_mode: 3, scopes: [...new Set(p.plan.tasks.map((t) => `${t.domain}:${t.capability}`.toLowerCase()))], max_risk: 3, budget_max_usd: p.plan.budget.high_usd, on_behalf: false, created_at: now, revoked_at: null, revoked_reason: null });
        }
        if (decision.action === "REQUEST_REVISION") {
          p.status = "SUPERSEDED";
          const cheaper = /cheaper|cost|budget/i.test(decision.note ?? "");
          const next: PlanVersion = structuredClone(p);
          next.id = id(); next.version = p.version + 1; next.status = "SUBMITTED"; next.decided_at = null; next.decision = null; next.decision_note = null; next.submitted_at = now;
          next.rationale = `Revision of version ${p.version}, asked for by the decision owner: "${decision.note}"`;
          if (cheaper) { next.plan.budget = { ...next.plan.budget, low_usd: +(next.plan.budget.low_usd * 0.7).toFixed(2), high_usd: +(next.plan.budget.high_usd * 0.7).toFixed(2) }; next.plan.tasks = next.plan.tasks.map((t) => (t.risk < 3 && t.rigor === "standard" ? { ...t, rigor: "light" } : t)); }
          next.plan.assumptions = [...next.plan.assumptions, `Changed after your feedback: "${decision.note}"`];
          s.plans.push(next); nextVersion = next.version;
        }
        save(s);
        return ok({ nextVersion });
      },
      async decisions(projectId) {
        const s = load();
        const ids = new Set(s.plans.filter((p) => p.project_id === projectId).map((p) => p.id));
        return ok(structuredClone(s.decisions.filter((d) => ids.has(d.proposal_id))));
      },
      async delegations(projectId) {
        const s = load();
        const ids = new Set(s.plans.filter((p) => p.project_id === projectId).map((p) => p.id));
        const org = s.data.projects.find((x) => x.id === projectId)?.organization_id;
        return ok(structuredClone(s.delegations.filter((d) => (d.proposal_id !== null && ids.has(d.proposal_id)) || (d.basis === "STANDING_POLICY" && d.organization_id === org && (d.project_id === null || d.project_id === projectId)))));
      },
      async revokeDelegation(delegationId, reason) {
        return mutate((s) => { const d = s.delegations.find((x) => x.id === delegationId); if (d && !d.revoked_at) { d.revoked_at = new Date().toISOString(); d.revoked_reason = reason || "Revoked"; } });
      },
      async mayDecideForClient(plan) {
        // Off until the client's owner lets the agency decide routine steps on this project; never above risk 3.
        return (load().standingProjects ?? []).includes(plan.project_id) && plan.impact <= 3;
      },
      async clientView(proposalId) {
        const s = load();
        const p = s.plans.find((x) => x.id === proposalId);
        if (!p) return fail("That plan couldn't be found.", "NOT_FOUND");
        const plan = p.plan;
        const { project, agency, total } = demoPrice(plan);
        const prev = s.plans.find((x) => x.project_id === p.project_id && x.version === p.version - 1);
        const inForce = (s.standingProjects ?? []).includes(p.project_id);
        const task = (id?: string) => plan.tasks.find((t) => t.id === id);
        return ok({
          id: p.id, project_id: p.project_id, version: p.version, status: p.status,
          summary: {
            objective: plan.objective,
            price: { project_fee: project, agency_fee_pct: DEMO_AGENCY_FEE_PCT, agency_fee: agency, pass_through: [], total },
            price_note: "Demo figures. The range allows for one round of revisions.",
            milestones: plan.milestones.map((m) => ({ name: m.name, target: null })),
          },
          phases: [{ phase: null, deliverables: plan.deliverables.map((d) => ({ name: d.name, due: null })) }],
          needs: { required: plan.open_context_needs.map((n) => ({ name: n, why: "" })), optional: [] },
          assumed: plan.assumptions,
          decisions: plan.decision_points.map((d) => {
            const t = task(d.task_id ?? undefined);
            return { description: d.description, decided_by: inForce && !(t && (t.risk > 3 || t.reversibility === 1)) ? "YOU_OR_AGENCY" as const : "YOU" as const };
          }),
          delegation: { in_force: inForce, always_yours: ["Anything with a risk above 3 of 5: each needs its own permission", "Spending beyond the approved total", "Anything that cannot be undone, or moves money: you and the agency both decide"] },
          more: { included: plan.scope_in, not_included: plan.scope_out, measures: plan.success_metrics.map((m) => ({ target: m.target, how: m.measurement, window: m.window })), risks: plan.risks },
          changes: prev ? { since: prev.version, lines: demoChanges(prev.plan, plan) } : null,
        });
      },
      async allowAgencyToDecide({ projectId }) {
        if (!steppedUp) return fail("For safety, please confirm it's you first.", "STEP_UP_REQUIRED");
        return mutate((s) => { s.standingProjects = [...new Set([...(s.standingProjects ?? []), projectId])]; });
      },
    },

    assets: {
      async list({ organizationId, projectId }) {
        const excluded = new Set<string>();
        return ok(structuredClone(load().assets.filter((a) => a.organization_id === organizationId && !excluded.has(a.id) && (a.scope === "ORGANIZATION" || a.project_id === projectId))));
      },
      async upload(input) {
        if (input.file.size > 50 * 1024 * 1024) return fail("That file is too large.", "TOO_LARGE");
        const asset: Asset = {
          id: id(), organization_id: input.organizationId, scope: input.scope, project_id: input.projectId, kind: input.kind, name: input.name,
          provenance: input.provenance, rights: input.rights, created_at: new Date().toISOString(),
          versions: [{ version: 1, mime: input.file.type || "application/octet-stream", size_bytes: input.file.size, scan_status: "CLEAN", scan_detail: "Demo data: not actually scanned.", created_at: new Date().toISOString() }],
        };
        const s = load(); s.assets.unshift(asset); save(s);
        return ok(structuredClone(asset));
      },
      async downloadLink() {
        return fail("Demo data has no stored files to download.");
      },
      async promote(assetId) {
        return mutate((s) => {
          const a = s.assets.find((x) => x.id === assetId);
          if (a && a.scope === "PROJECT") s.assets.unshift({ ...structuredClone(a), id: id(), scope: "ORGANIZATION", project_id: null });
        });
      },
      async exclude() {
        return ok(undefined as void);
      },
    },
  };
}
