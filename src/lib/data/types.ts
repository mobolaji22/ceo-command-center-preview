import type { AppRole, Asset, AssetKind, ClientData, DecisionEntry, DelegationView, OrgRole, OwnerData, PlanChange, PlanVersion, Session } from "../model";

/**
 * The ONLY door between the Command Center UI and data.
 *
 * Components call this interface and nothing else: no database client, no vendor SDK,
 * no business logic. Two implementations exist:
 *   - fixtures: in-memory demo data, so the UI can be designed and developed with no backend
 *   - api:      the dev-playbook-v4 API, reached only through this app's own server (the BFF, see docs/INTEGRATION.md)
 *
 * Commands never log events or decide authority. In the real system the API does both
 * (authority policy, event store, audit); the fixtures implementation only imitates it.
 */

export type Failure = {
  message: string;
  /** The API's machine-readable reason when it gave one, for example STEP_UP_REQUIRED. */
  code?: string;
};
export type Result<T = void> = { data: T | null; error: Failure | null };

export const ok = <T>(data: T): Result<T> => ({ data, error: null });
export const fail = <T = never>(message: string, code?: string): Result<T> => ({
  data: null,
  error: code ? { message, code } : { message },
});

export type DataSourceKind = "fixtures" | "api";

/** What an implementation can do. The UI hides what is not offered instead of showing a button that fails. */
export type Capabilities = {
  /** Constraints and evidence requests on an authorization (arrive with interventions). */
  approvalNotes: boolean;
  /** Free-text timeline updates posted by hand. */
  timelineUpdates: boolean;
};

/** Something that arrives with a request. `scope` is where it should live: this request's project, or the client's library. */
export type NewAttachment =
  | { kind: "file"; file: File; scope: "PROJECT" | "ORGANIZATION" }
  | { kind: "link"; url: string; scope: "PROJECT" | "ORGANIZATION" };

export type IntentInput = { organizationId: string; text: string; attachments: NewAttachment[] };

/** The ways to answer one item of the materials list. */
export type MaterialAnswer =
  | { action: "UPLOAD"; file: File }
  | { action: "LINK"; url: string }
  | { action: "CONNECT"; assetId: string }
  | { action: "NONE" }
  | { action: "SOURCE" };

export type AssetUploadInput = {
  organizationId: string;
  /** Compose-time: set aside for a request being written, placed when it is submitted. */
  staged?: boolean;
  scope: "ORGANIZATION" | "PROJECT";
  projectId: string | null;
  kind: AssetKind;
  name: string;
  rights: string;
  provenance: string;
  file: File;
};

export interface DataSource {
  readonly kind: DataSourceKind;
  readonly capabilities: Capabilities;

  /** Passwordless (ADR-0007): an emailed link or six-digit code is the whole sign-in. No passwords exist. */
  auth: {
    getSession(): Promise<Session | null>;
    /** Emails a sign-in link and code. Always succeeds from the caller's view, so it cannot reveal who has an account. */
    requestSignIn(email: string): Promise<Result>;
    verifyLink(token: string): Promise<Result<Session>>;
    verifyCode(email: string, code: string): Promise<Result<Session>>;
    acceptInvitation(token: string): Promise<Result<Session>>;
    /** Sensitive actions (inviting people) need a fresh proof: a code emailed to the signed-in person. */
    requestStepUp(): Promise<Result>;
    verifyStepUp(code: string): Promise<Result>;
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

    /** Marks the CEO's visit and returns when they were last here (ISO), or null. */
    markSeen(): Promise<string | null>;

    // Organizations and people
    createOrganization(input: { name: string; mission: string | null }): Promise<Result>;
    invitePerson(input: { organizationId: string; email: string; role: OrgRole }): Promise<Result>;
    removePerson(organizationId: string, userId: string): Promise<Result>;

    postUpdate(projectId: string, input: { summary: string; share: boolean }): Promise<Result>;
  };

  /** Where work enters. A request is understood, questions are asked, and only then does a project open (there is no create-project command). */
  intents: {
    /** Stages each attachment, then submits the request. The answer says where it stands. */
    submit(input: IntentInput): Promise<Result<{ status: string; projectId: string | null }>>;
    answer(intentId: string, clarificationId: string, answer: { optionId?: string; text?: string; useDefault?: boolean }): Promise<Result>;
    respond(requirementId: string, answer: MaterialAnswer, organizationId: string): Promise<Result>;
  };

  /**
   * The plan for a project (P3): read it, ask for a change, approve or decline, see what changed and what was decided, and
   * take back what the agency may do without asking. The API decides who may; the UI only hides what would be refused.
   */
  plans: {
    /** Every version, oldest first. A client sees only what has been submitted to them. */
    list(projectId: string): Promise<Result<PlanVersion[]>>;
    /** What changed between a version and the one it replaced. */
    changes(proposalId: string): Promise<Result<PlanChange>>;
    /** A request for a change is answered with the next version straight away. */
    decide(proposalId: string, decision: { action: "APPROVE" | "REQUEST_REVISION" | "REJECT"; note?: string }): Promise<Result<{ nextVersion: number | null }>>;
    decisions(projectId: string): Promise<Result<DecisionEntry[]>>;
    delegations(projectId: string): Promise<Result<DelegationView[]>>;
    /** The client's owner or the CEO. From then on every step of the project asks first. */
    revokeDelegation(delegationId: string, reason: string): Promise<Result>;
    /**
     * The CEO only: has the client's owner given permission to decide this plan for them? Used to show the action or explain
     * why it is not there; the API still refuses a decision without the permission.
     */
    mayDecideForClient(plan: PlanVersion): Promise<boolean>;
  };

  /** The asset library: files held for a client, in their organization's library or one project. */
  assets: {
    list(input: { organizationId: string; projectId?: string | undefined }): Promise<Result<Asset[]>>;
    /** Asks for a signed upload link, sends the file, then has the server measure and scan it. */
    upload(input: AssetUploadInput): Promise<Result<Asset>>;
    /** A short-lived link to the newest clean version. Unscanned files have none. */
    downloadLink(assetId: string): Promise<Result<{ url: string }>>;
    /** Client Owner: copy a project asset into the organization library. */
    promote(assetId: string): Promise<Result>;
    /** The project stops inheriting one library asset. */
    exclude(projectId: string, assetId: string): Promise<Result>;
  };
}

export type { AppRole };
