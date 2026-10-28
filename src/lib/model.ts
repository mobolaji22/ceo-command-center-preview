// Read-model v0 for the Command Center.
//
// Field names and shapes are the ones the copied UI components already use
// (generated mechanically from the preview's row types). This file is the ONLY
// place the UI's data shapes live. It is a stand-in until `packages/contracts`
// in dev-playbook-v4 exists (plan P0); then it is replaced by the generated
// client types. Never import a database client or vendor SDK here.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** The ten project statuses of the v4 lifecycle (ADR-0006). What a project is waiting for is `wait_reason`, not a status. */
export type ProjectStatus =
  | "INTAKE" | "PROPOSED" | "ACTIVE" | "WAITING" | "DELIVERED" | "MONITORING" | "COMPLETED" | "PAUSED" | "CANCELLED" | "ARCHIVED";
export type ContextStatus =
  | "MISSING" | "REQUESTED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "ASSUMED" | "VALIDATED" | "REJECTED" | "EXPIRED";
export type AppRole = "owner" | "client";
export type ApprovalStatus = "REQUESTED" | "GRANTED" | "REJECTED" | "EXPIRED";
export type ArtifactStatus = "DRAFT" | "PROPOSED" | "APPROVED" | "REJECTED" | "SUPERSEDED" | "FINAL";
export type DecisionStatus = "PROPOSED" | "WAITING_FOR_HUMAN" | "ACCEPTED" | "REJECTED" | "DEFERRED" | "SUPERSEDED";
export type TaskStatus = "PENDING" | "READY" | "RUNNING" | "WAITING" | "BLOCKED" | "FAILED" | "COMPLETED" | "CANCELLED";

export type Project = {
  completed_at: string | null
  created_at: string
  description: string | null
  domains: string[]
  id: string
  name: string
  objective: string | null
  organization_id: string | null
  priority: number
  started_at: string | null
  status: ProjectStatus
  /** Why a WAITING project is waiting (for example CLIENT_INPUT or APPROVAL). */
  wait_reason?: string | null
};

export type Task = {
  approval_required: boolean
  completed_at: string | null
  created_at: string
  description: string | null
  domain: string
  id: string
  project_id: string
  reversibility: number
  risk: number
  started_at: string | null
  status: TaskStatus
  title: string
};

export type Decision = {
  confidence: number | null
  created_at: string
  id: string
  options: Json
  project_id: string
  question: string
  rationale: string | null
  recommendation: string | null
  resolved_at: string | null
  reversibility: number | null
  risk: number | null
  selected_option: string | null
  status: DecisionStatus
};

export type Approval = {
  consequences: string | null
  constraints: string | null
  created_at: string
  evidence_request: string | null
  id: string
  project_id: string
  reason: string
  recommendation: string | null
  requires_client: boolean
  resolution_note: string | null
  resolved_at: string | null
  resolved_by: string | null
  reversibility: number
  risk: number
  status: ApprovalStatus
  /** True when the CEO decided this for the client, using a permission the client owner gave. */
  on_behalf?: boolean
  target_type: string
  title: string
};

export type Evidence = {
  approval_id: string | null
  claim: string
  confidence: number
  created_at: string
  id: string
  project_id: string
  source: string
  source_type: string
};

export type Artifact = {
  client_visible: boolean
  created_at: string
  description: string | null
  id: string
  name: string
  project_id: string
  status: ArtifactStatus
  storage_path: string | null
  type: string
};

export type Requirement = {
  assigned_to_client: boolean
  category: string
  created_at: string
  deadline: string | null
  description: string
  id: string
  name: string
  project_id: string
  reason: string
  required: boolean
  resolved_at: string | null
  response: string | null
  response_file_path: string | null
  status: ContextStatus
};

export type Outcome = {
  actual_value: string
  created_at: string
  expected_value: string
  id: string
  interpretation: string | null
  metric: string
  project_id: string
};

export type V4Event = {
  actor_id: string | null
  client_visible: boolean
  created_at: string
  id: string
  project_id: string | null
  summary: string
  type: string
};

export type IntentStatus = "PROPOSED" | "RECEIVED" | "CLARIFYING" | "AWAITING_REASONING" | "UNDERSTOOD" | "PLANNED" | "SUPERSEDED" | "REJECTED";
export type MaterialWay = "UPLOAD" | "LINK" | "CONNECT" | "NONE" | "SOURCE";

/** What someone asked for, where it stands, and what we are asking back (at most three questions and one materials list). */
export type Intent = {
  id: string
  organization_id: string
  project_id: string | null
  source: "CEO_DIRECTIVE" | "CLIENT_INTENT" | "AGENCY_PROPOSED"
  status: IntentStatus
  text: string
  initiator_id: string
  rejection_reason: string | null
  created_at: string
  understood_at: string | null
  /** The latest version of this intent's plan, if it has one. Only a SUBMITTED plan waits for a signature; a PLANNED intent keeps that status after approval. */
  plan_status: PlanStatus | null
  questions: Array<{
    id: string
    question: string
    why: string
    decision: string
    options: Array<{ id: string; label: string; tradeoff: string }>
    default_option_id: string | null
  }>
  /** Things we settled by assuming instead of asking. */
  assumptions: Array<{ id: string; question: string; assumed: string; forced: boolean }>
  answers: Array<{ id: string; question: string; answer: string }>
  materials: Array<{ requirement_id: string; name: string; why: string; if_missing: string; required: boolean; ways: MaterialWay[]; sourcing: boolean }>
};

export type PlanStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REVISION_REQUESTED" | "REJECTED" | "SUPERSEDED";
export type PlanDecision = "APPROVED" | "REVISION_REQUESTED" | "REJECTED";

/** What a plan says, in the order a person reads it. */
export type PlanContent = {
  objective: string
  scope_in: string[]
  scope_out: string[]
  deliverables: Array<{ id: string; name: string; domain: string }>
  success_metrics: Array<{ id: string; metric: string; baseline: string | null; target: string; measurement: string; window: string; data_source: string }>
  tasks: Array<{ id: string; title: string; domain: string; capability: string; rigor: string; risk: number; reversibility: number; depends_on: string[] }>
  milestones: Array<{ name: string; after_tasks: string[] }>
  budget: { low_usd: number; high_usd: number; confidence: number }
  risks: Array<{ risk: string; mitigation: string }>
  assumptions: string[]
  open_context_needs: string[]
  decision_points: Array<{ task_id: string | null; description: string }>
  /** Steps the plan lets go ahead of a domain they would otherwise wait for, with the reason. For the CEO, not the client. */
  phasing: Array<{ task_id: string; upstream: string; reason: string }>
  /** Domains in the work with no capability yet: a person does their part. */
  unstaffed: string[]
  /** Domains a standing exemption kept out, and what would have called them up (ADR-0043). */
  exempt: Array<{ upstream: string; dependent: string; via: string }>
};

/** One version of a project's plan. A change is a new version; earlier ones stay on record. */
export type PlanVersion = {
  id: string
  project_id: string
  organization_id: string
  version: number
  status: PlanStatus
  /** Who must say yes: the client's owner, or the CEO for the agency's own work. */
  decision_owner: "CLIENT_OWNER" | "CEO"
  impact: number
  reversibility: number
  rationale: string | null
  submitted_at: string | null
  decided_at: string | null
  decision: PlanDecision | null
  decision_note: string | null
  /** The CEO decided for the client, under a permission their owner gave. */
  on_behalf: boolean
  plan: PlanContent
};

/** A range of money, low to high, in US dollars. */
export type UsdRange = { low: number; high: number };

/** A material still needed from the client (the client views list required ones first). */
export type ClientNeed = { requirement_id: string; name: string; why: string; if_missing: string; ways: MaterialWay[]; sourcing: boolean };

/**
 * What a client reads about one request (P6.20): one status line, the open questions in order with their place, what is still
 * needed (required first), what was assumed. Ordered and trimmed by v4; the UI renders it as it is.
 */
export type ClientIntentView = {
  id: string
  text: string
  created_at: string
  status: { kind: "READING" | "QUESTIONS" | "PLANNING" | "PLAN_READY" | "CLOSED"; line: string }
  questions: Array<{ id: string; position: number; of: number; question: string; why: string; options: Array<{ id: string; label: string; tradeoff: string }>; default_option_id: string | null }>
  needs: { required: ClientNeed[]; optional: ClientNeed[] }
  assumed: Array<{ id: string; question: string; answer: string }>
  plan: { id: string; version: number; status: PlanStatus } | null
};

/**
 * What a client reads about a plan (P6.20): the summary they decide on (what, price, when), what they get by phase, what is
 * needed from them, what was assumed, the decisions to come and who makes them, and the rest folded. No internal work.
 */
export type ClientPlanView = {
  id: string
  project_id: string
  version: number
  status: PlanStatus
  summary: {
    objective: string
    price: { project_fee: UsdRange; agency_fee_pct: number; agency_fee: UsdRange; pass_through: Array<{ item: string } & UsdRange>; total: UsdRange } | null
    price_note: string
    milestones: Array<{ name: string; target: string | null }>
  }
  phases: Array<{ phase: number | null; deliverables: Array<{ name: string; due: string | null }> }>
  needs: { required: Array<{ name: string; why: string }>; optional: Array<{ name: string; why: string }> }
  assumed: string[]
  decisions: Array<{ description: string; decided_by: "YOU" | "YOU_OR_AGENCY" }>
  delegation: { in_force: boolean; always_yours: string[] }
  more: { included: string[]; not_included: string[]; measures: Array<{ target: string; how: string; window: string }>; risks: Array<{ risk: string; mitigation: string }> }
  /** What changed since the previous version, in the client's terms (price, what they get, dates, scope); null on version 1. */
  changes: { since: number; lines: string[] } | null
};

/** What changed between two versions, in plain sentences, with the money called out. */
export type PlanChange = {
  from_version: number
  to_version: number
  summary: string[]
  budget: { from_low: number; from_high: number; to_low: number; to_high: number } | null
  unchanged: boolean
};

export type DecisionEntry = {
  proposal_id: string
  version: number
  decision: PlanDecision
  decided_by_role: "CLIENT_OWNER" | "CEO"
  on_behalf: boolean
  note: string | null
  decided_at: string
};

/** One entry of a client's audit chain: what was sealed, when, and by whom. The contents and hashes stay with the API. */
export type AuditEntryView = { sequence: number; kind: string; subject_type: string; actor_id: string; created_at: string };
/** Whether a client's audit chain is intact: every entry follows the one before it and matches what was sealed. */
export type AuditChain = { ok: boolean; entries: AuditEntryView[]; broken_at: number | null; reason: string | null };

/** What the agency may do on a project without asking again: the approved plan, within limits. */
export type DelegationView = {
  id: string
  /** PLAN_APPROVAL: the approved plan. STANDING_POLICY: named kinds of work for a limited time, not tied to one plan. */
  basis: "PLAN_APPROVAL" | "STANDING_POLICY"
  organization_id: string
  /** Null for a standing policy. */
  proposal_id: string | null
  /** Null for a standing policy that covers the whole client. */
  project_id: string | null
  /** When a standing policy ends; always set for one. */
  expires_at: string | null
  approval_level: string
  max_autonomy_mode: number
  /** "domain:capability" */
  scopes: string[]
  max_risk: number
  budget_max_usd: number | null
  on_behalf: boolean
  created_at: string
  revoked_at: string | null
  revoked_reason: string | null
};

export type Organization = {
  created_at: string
  id: string
  mission: string | null
  name: string
  /** `INTERNAL` holds the agency's own work (v4 ADR-0040); every other organization the agency sees is a client. Absent from an older API. */
  kind?: "CLIENT" | "INTERNAL"
};

export type OrgRole = "CLIENT_OWNER" | "CLIENT_MEMBER";

export type Profile = {
  created_at: string
  display_name: string | null
  email: string | null
  id: string
  /** The client organizations this person belongs to, and their role in each. */
  memberships: Array<{ organization_id: string; role: OrgRole }>
};

export type AssetKind =
  | "DOCUMENT" | "IMAGE" | "VIDEO" | "AUDIO" | "LOGO" | "FONT" | "BRAND_GUIDE" | "COPY_DECK" | "DESIGN_FILE" | "DATA_EXPORT" | "SITE_SNAPSHOT" | "OTHER";
export type ScanStatus = "PENDING_UPLOAD" | "PENDING_SCAN" | "CLEAN" | "INFECTED" | "REJECTED";

/** A stored file in an organization's library or one project. Only a CLEAN version can be downloaded. */
export type Asset = {
  id: string
  organization_id: string
  scope: "ORGANIZATION" | "PROJECT"
  project_id: string | null
  kind: string
  name: string
  provenance: string
  rights: string
  created_at: string
  /** Newest first. */
  versions: Array<{ version: number; mime: string; size_bytes: number; scan_status: ScanStatus; scan_detail: string | null; created_at: string }>
};

/** Everything the CEO view renders from, in one read model. */
export type OwnerData = {
  projects: Project[];
  tasks: Task[];
  decisions: Decision[];
  approvals: Approval[];
  evidence: Evidence[];
  artifacts: Artifact[];
  requirements: Requirement[];
  outcomes: Outcome[];
  events: V4Event[];
  intents: Intent[];
  organizations: Organization[];
  /** People in client organizations, with their roles. */
  clients: Profile[];
};

/** What a client may see: only their own projects and what was shared with them. */
export type ClientData = Pick<OwnerData, "projects" | "events" | "artifacts" | "approvals" | "requirements" | "intents">;

export type Session = {
  userId: string;
  email: string;
  displayName: string;
  role: AppRole;
  /** Client organizations this person belongs to (empty for the CEO, who reaches all of them). */
  memberships: Array<{ organizationId: string; role: OrgRole }>;
};

/* ---- The work itself (CC-4): a run, its tasks, its budget, and what it is waiting to ask ---- */

export type RunStatus = "RUNNING" | "WAITING" | "PAUSED" | "COMPLETED" | "FAILED" | "CANCELLED";
export type RunTask = {
  id: string; plan_task_id: string; title: string; domain: string;
  status: "PENDING" | "READY" | "RUNNING" | "WAITING" | "WAITING_FOR_HUMAN" | "BLOCKED" | "FAILED" | "COMPLETED" | "CANCELLED";
  wait_reason: string | null; depends_on: string[];
  /** Something it was built on changed, so it is being done again. */
  stale: boolean;
};
export type RunView = {
  id: string; project_id: string; status: RunStatus; wait_reason: string | null; plan_version: number;
  close_reason: string | null; started_at: string; ended_at: string | null; tasks: RunTask[];
};
/** How much of what the client approved has been used. Totals only. */
export type BudgetView = { run_id: string; run_status: RunStatus; approved_usd: number | null; used_usd: number; used_percent: number | null };

/** One answer a question offers. `stepUp` is the API's word on whether choosing it needs a fresh emailed code; the UI keeps no list of its own. */
export type QuestionOption = { id: string; stepUp: boolean };
/** "A human is needed": what a stopped run is waiting for somebody to answer. */
export type Question = {
  id: string; project_id: string; organization_id: string; run_id: string; task_id: string | null;
  reason: string; routed_to: "CLIENT_OWNER" | "CEO"; status: "OPEN" | "REMINDED" | "ESCALATED" | "EXPIRED";
  title: string; summary: string;
  /** The system's own account of what went wrong. Only the agency receives it. */
  detail: string | null;
  options: QuestionOption[]; recommendation: { option: string; why: string } | null; deadline: string | null; created_at: string;
};
export type Answer = { option: string; note?: string; toUsd?: number; evidence?: string };

/* ---- What people are told (CC-5): briefs, the sources behind each statement, and how a person wants to be told ---- */

export type BriefType = "KICKOFF" | "PROGRESS" | "EXCEPTION" | "DIGEST" | "HANDOFF" | "OUTCOME" | "IMPROVEMENT";
export type BriefSummary = {
  id: string; organization_id: string; project_id: string | null; type: BriefType; audience: "CLIENT" | "AGENCY";
  title: string; level: number; created_at: string;
};
/** Where a statement comes from: a record, and where in it a value is quoted. A sum cites several records. */
export type Source = { type: string; ids: string[]; path: string | null; expect: string | number | null; sum: boolean };
export type BriefStatement = { position: number; section: string; kind: "FACT" | "GAP"; text: string; sources: Source[] };
export type BriefDoc = BriefSummary & { statements: BriefStatement[] };
/** The result of opening every source: each one exists, belongs here, and says what the statement says. */
export type BriefCheck = { ok: boolean; facts: number; gaps: number; problems: string[] };

export type DigestFrequency = "DAILY" | "WEEKLY" | "OFF";
export type NotificationPrefs = {
  timezone: string;
  quiet_hours: { start: string; end: string } | null;
  /** Only 3 to 5 can interrupt; lower is not offered. */
  min_interrupt_level: number;
  email_enabled: boolean;
  digest: { frequency: DigestFrequency; time: string; weekday: number };
};
export type NotificationItem = {
  id: string; brief_id: string; title: string; type: BriefType; project_id: string | null; level: number;
  status: "QUEUED" | "SENT" | "FAILED" | "WAITING_DIGEST" | "DIGESTED" | "SKIPPED"; reason: string | null; created_at: string;
};

/** A question that can be answered from an email, without signing in: what it is and what answering would do. */
export type ActionLinkView = {
  state: "READY" | "USED" | "EXPIRED" | "ANSWERED";
  option: "RESUME" | "RETRY" | "REWORK";
  label: string; does: string; title: string; summary: string; project: string | null; expires_at: string;
};

/** A domain the agency works in, as `GET /v1/domains` serves it (dev-playbook-v4 ADR-0017). The rooms are drawn from these. */
/** One domain as `GET /v1/domains` serves it (v4 ADR-0017, ADR-0018, ADR-0019): its department is the corridor's wing. */
export type DomainView = {
  code: string;
  name: string;
  department: { code: string; name: string };
  pack: {
    version: string;
    basis: "contract" | "advisory-standin";
    contract: { document: string; version: string } | null;
    stages: string[];
    implementation: { "implemented-and-tested": number; partial: number; missing: number };
  };
};

/** The effort levels a task is planned at (v4 `RIGOR_TIERS`). A rate card prices each one. */
export const RIGORS = ["light", "standard", "strict", "critical"] as const;
export type Rigor = (typeof RIGORS)[number];

/** Who a fee policy applies to: the whole agency, one client, or one project. The most specific applies to a plan. */
export type FeeScope = { kind: "agency" } | { kind: "organization"; id: string } | { kind: "project"; id: string };

/** The agency's fee and rate card (ADR-0028), as the CEO sets them. Plans already sent keep their price. */
export type FeesView = {
  policies: Array<{ scope: FeeScope; agency_fee_pct: number; updated_at: string }>;
  rates: Array<{ capability: string; rigor: Rigor; unit_usd: number; updated_at: string }>;
};

/** What the agency lets paid models spend this month, and what is spent. No envelope means no paid-model spend. */
export type SpendView = {
  monthly_ceiling_usd: number; per_call_ceiling_usd: number; spent_usd: number; reserved_usd: number; remaining_usd: number;
  calls: number; refused: number; enforced: boolean;
};

/** How the agency runs (ADR-0027): read only; the mode is set when it is deployed. */
export type SystemView = {
  agency_mode: "DEMO" | "LIVE";
  reads_with: "KEYWORDS" | "MODEL" | "MANUAL_BRIDGE";
  model_switched_on: boolean;
  waiting: Array<{ step: "INTERPRETATION" | "PLAN"; reason: "NO_ENVELOPE" | "CEILING_REACHED" | "PROVIDER_UNAVAILABLE" | "ANSWER_UNUSABLE"; count: number }>;
  revisions_waiting: number;
};

/** A place the person is signed in. */
export type SessionView = { id: string; created_at: string; last_seen_at: string; user_agent: string | null; current: boolean };
