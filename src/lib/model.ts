// Read-model v0 for the Command Center.
//
// Field names and shapes are the ones the copied UI components already use
// (generated mechanically from the preview's row types). This file is the ONLY
// place the UI's data shapes live. It is a stand-in until `packages/contracts`
// in dev-playbook-v4 exists (plan P0); then it is replaced by the generated
// client types. Never import a database client or vendor SDK here.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ProjectStatus =
  | "DORMANT" | "INTENT" | "DISCOVERY" | "DEFINED" | "PLANNED" | "IN_PROGRESS" | "REVIEW"
  | "WAITING_FOR_HUMAN" | "BLOCKED" | "APPROVAL" | "EXECUTION" | "VALIDATION" | "COMPLETED"
  | "MONITORING" | "PAUSED" | "CANCELLED" | "SUPERSEDED" | "ARCHIVED";
export type ContextStatus =
  | "MISSING" | "REQUESTED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "ASSUMED" | "VALIDATED" | "REJECTED" | "EXPIRED";
export type AppRole = "owner" | "client";
export type ApprovalStatus = "REQUESTED" | "GRANTED" | "REJECTED" | "EXPIRED";
export type ArtifactStatus = "DRAFT" | "PROPOSED" | "APPROVED" | "REJECTED" | "SUPERSEDED" | "FINAL";
export type DecisionStatus = "PROPOSED" | "WAITING_FOR_HUMAN" | "ACCEPTED" | "REJECTED" | "DEFERRED" | "SUPERSEDED";
export type TaskStatus = "PENDING" | "READY" | "RUNNING" | "WAITING" | "WAITING_FOR_HUMAN" | "BLOCKED" | "FAILED" | "COMPLETED" | "CANCELLED";

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

export type Directive = {
  client_id: string | null
  content: string
  created_at: string
  created_by: string
  id: string
  organization_id: string | null
  project_id: string | null
};

export type Organization = {
  created_at: string
  id: string
  mission: string | null
  name: string
};

export type Profile = {
  created_at: string
  display_name: string | null
  email: string | null
  id: string
};

export type ProjectClient = {
  created_at: string
  project_id: string
  user_id: string
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
  directives: Directive[];
  organizations: Organization[];
  clients: Profile[];
  links: ProjectClient[];
};

/** What a client may see: only their own projects and what was shared with them. */
export type ClientData = Pick<OwnerData, "projects" | "events" | "artifacts" | "approvals" | "requirements">;

export type Session = {
  userId: string;
  email: string;
  displayName: string;
  role: AppRole;
};
