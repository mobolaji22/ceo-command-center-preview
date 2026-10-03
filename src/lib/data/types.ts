import type {
  AppRole,
  ClientData,
  OwnerData,
  Project,
  ProjectStatus,
  Session,
  TaskStatus,
} from "../model";

/**
 * The ONLY door between the Command Center UI and data.
 *
 * Components call this interface and nothing else: no database client, no vendor SDK,
 * no business logic. Two implementations exist:
 *   - fixtures: in-memory demo data, so the UI can be designed and developed with no backend
 *   - api:      the dev-playbook-v4 API (see docs/INTEGRATION.md for the endpoint map)
 *
 * Commands never log events or decide authority. In the real system the API does both
 * (authority policy, event store, audit); the fixtures implementation only imitates it.
 */

export type Failure = { message: string };
export type Result<T = void> = { data: T | null; error: Failure | null };

export const ok = <T>(data: T): Result<T> => ({ data, error: null });
export const fail = <T = never>(message: string): Result<T> => ({ data: null, error: { message } });

export type DataSourceKind = "fixtures" | "api";

export type Capabilities = {
  /**
   * "Manage" can hand-create tasks, approvals, decisions, evidence, outcomes and requirements.
   * That is a seeding tool for demos. In the real system the runtime creates those records, so
   * the api implementation reports false and the forms are hidden.
   */
  seedRecords: boolean;
};

export type DirectiveInput = {
  content: string;
  projectId: string | null;
  organizationId: string | null;
  clientId: string | null;
};

export type ProjectInput = {
  name: string;
  description: string | null;
  objective: string | null;
  priority: number;
  organization_id: string | null;
  domains: string[];
};

export type ApprovalInput = {
  title: string;
  reason: string;
  recommendation: string;
  consequences: string;
  risk: number;
  reversibility: number;
  requires_client: boolean;
};

export type DeliverableInput = {
  name: string;
  description: string | null;
  share: boolean;
  file: File | null;
};

export interface DataSource {
  readonly kind: DataSourceKind;
  readonly capabilities: Capabilities;

  auth: {
    getSession(): Promise<Session | null>;
    signInWithPassword(email: string, password: string): Promise<Result<Session>>;
    requestPasswordReset(email: string, redirectTo: string): Promise<Result>;
    /** True when the user arrived from an emailed link that allows choosing a password. */
    hasRecoverySession(): Promise<boolean>;
    setPassword(password: string): Promise<Result<Session>>;
    signOut(): Promise<void>;
    /** Calls back when the session may have changed (sign-in, sign-out, another tab). */
    subscribe(onChange: () => void): () => void;
  };

  queries: {
    ownerData(): Promise<OwnerData>;
    clientData(): Promise<ClientData>;
  };

  commands: {
    // Authorizations ("contracts")
    resolveApproval(id: string, approved: boolean): Promise<Result>;
    setApprovalConstraints(id: string, text: string): Promise<Result>;
    requestApprovalEvidence(id: string, text: string): Promise<Result>;
    clientResolveApproval(id: string, approved: boolean, note: string): Promise<Result>;

    // Intent
    issueDirective(input: DirectiveInput): Promise<Result>;

    /** Marks the CEO's visit and returns when they were last here (ISO), or null. */
    markSeen(): Promise<string | null>;

    // Organizations, people, projects
    createOrganization(input: { name: string; mission: string | null }): Promise<Result>;
    inviteClient(input: { email: string; projectIds: string[]; redirectTo: string }): Promise<Result<{ invited: boolean }>>;
    unlinkClient(projectId: string, userId: string): Promise<Result>;
    createProject(input: ProjectInput): Promise<Result<Project>>;
    setProjectStatus(projectId: string, status: ProjectStatus): Promise<Result>;

    // Shared with the client
    addDeliverable(projectId: string, input: DeliverableInput): Promise<Result>;
    postUpdate(projectId: string, input: { summary: string; share: boolean }): Promise<Result>;

    // Seeding tools (capabilities.seedRecords)
    createTask(projectId: string, input: { title: string; domain: string; risk: number; approval_required: boolean }): Promise<Result>;
    setTaskStatus(taskId: string, status: TaskStatus): Promise<Result>;
    requestApproval(projectId: string, input: ApprovalInput): Promise<Result>;
    recordDecision(projectId: string, input: { question: string; options: string[]; recommendation: string | null }): Promise<Result>;
    addRequirement(projectId: string, input: { name: string; description: string; assigned_to_client: boolean }): Promise<Result>;
    addEvidence(projectId: string, input: { claim: string; source: string; confidence: number }): Promise<Result>;
    recordOutcome(projectId: string, input: { metric: string; expected_value: string; actual_value: string }): Promise<Result>;
  };
}

export type { AppRole };
