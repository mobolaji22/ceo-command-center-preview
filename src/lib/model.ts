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

export type IntentStatus = "PROPOSED" | "RECEIVED" | "CLARIFYING" | "UNDERSTOOD" | "PLANNED" | "SUPERSEDED" | "REJECTED";
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

/** What the agency may do on a project without asking again: the approved plan, within limits. */
export type DelegationView = {
  id: string
  proposal_id: string
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
