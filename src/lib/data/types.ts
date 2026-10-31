import type { AnnotationKind, AnnotationTarget, SddAnnotation, SddDocument, SddVersion, SddView } from "@/lib/design/v4";
import type { ClientBookView, KeptBrand } from "@/lib/deliverables/v4";
import type { ActionLinkView, Answer, AuditChain, AppRole, Asset, AssetKind, ClientIntentView, ClientPlanView, BriefCheck, BriefDoc, BriefSummary, BriefType, BudgetView, ClientData, DecisionEntry, DomainView, DelegationView, NotificationItem, NotificationPrefs, OrgRole, OwnerData, PlanChange, PlanVersion, Question, RunView, Session, FeeScope, FeesView, Rigor, SessionView, SpendView, SystemView } from "../model";

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

/** `organizationId: null` is the agency's own work: v4 files it under its internal organization (ADR-0040). Only the agency may send null. */
export type IntentInput = { organizationId: string | null; text: string; attachments: NewAttachment[] };

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
    /** The domains the agency works in, in order, with their names (the rooms). The same for every signed-in person. */
    domains(): Promise<DomainView[]>;
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
    submit(input: IntentInput): Promise<Result<{ intentId: string; status: string; projectId: string | null }>>;
    answer(intentId: string, clarificationId: string, answer: { optionId?: string; text?: string; useDefault?: boolean }): Promise<Result>;
    respond(requirementId: string, answer: MaterialAnswer, organizationId: string): Promise<Result>;
    /** What the client reads about one request, ordered and trimmed by v4 (P6.20). */
    clientView(intentId: string): Promise<Result<ClientIntentView>>;
  };

  /**
   * The plan for a project (P3): read it, ask for a change, approve or decline, see what changed and what was decided, and
   * take back what the agency may do without asking. The API decides who may; the UI only hides what would be refused.
   */
  /**
   * The work an approved plan became (CC-4). Pausing, resuming and stopping are for the project's decision owner and the CEO; the
   * API decides who may do what and says so plainly. The budget is totals only; cost records stay with the agency.
   */
  /**
   * v4's design document of a project (ADR-0049, ADR-0051): read it, and for the agency, edit the one draft and send it for a decision.
   * A save names the hash of the draft it was made on, so a stale save is refused instead of overwriting a newer one. Feedback is
   * appended and answered through its own calls, which v4 stamps with who and when; a save never carries a change to it.
   */
  design: {
    /** The approved revision, and the one in progress if this person may see it. */
    read(projectId: string): Promise<Result<SddView>>;
    /**
     * Choose a direction where the territories are drawn. It answers the question the work asked, the same one a numbered reply
     * answers, so v4 decides who may (the client's owner, or the CEO under their permission). `changes` is "select with changes".
     */
    selectTerritory(projectId: string, territoryId: string, changes?: string): Promise<Result>;
    /** Autosave into the draft. `expectedHash` is the draft's hash when the edit began, or null to start one from the approved revision. */
    save(projectId: string, document: SddDocument, expectedHash: string | null): Promise<Result<{ documentHash: string }>>;
    /** Sends the draft as seen (its hash) to the decision owner. */
    submit(projectId: string, documentHash: string): Promise<Result>;
    /** The approved versions, newest first, and one of them in full to restore from. */
    versions(projectId: string): Promise<Result<SddVersion[]>>;
    version(projectId: string, version: number): Promise<Result<SddDocument>>;
    /** Feedback from the agency or the client's owner, on the whole design or one part of it. */
    annotate(projectId: string, input: { target: AnnotationTarget; kind: AnnotationKind; text: string }): Promise<Result<{ annotation: SddAnnotation; documentHash: string }>>;
    /** The agency's answer: addressed in the revision being worked on, or declined with a reason the client reads. */
    settle(projectId: string, annotationId: string, input: { status: "ADDRESSED" | "DECLINED"; reason?: string }): Promise<Result<{ annotation: SddAnnotation; documentHash: string }>>;
    /** The decision owner's answer to a submitted revision. Approving needs a fresh proof of who is deciding. */
    decide(proposalId: string, input: { action: "APPROVE" | "REQUEST_REVISION"; note?: string }): Promise<Result>;
  };
  /**
   * The client's book (v4 ADR-0053, ADR-0054): one document with a brand part and a market part, each read from the work its owners
   * finished and checked. v4 decides who reads what: a client gets each part once it is fit to read, and the book is "not
   * produced" (null here) while no part is, never an empty book.
   */
  deliverables: {
    book(projectId: string): Promise<Result<ClientBookView | null>>;
    /**
     * The agency proposes keeping this project's brand for the client's next projects. It writes a new version of the
     * organization's kept Brand book and asks the client's owner; keeping an unchanged brand again asks nothing new.
     */
    keepBrand(projectId: string): Promise<Result<{ proposalId: string; written: boolean }>>;
    /** The newest proposal to keep this project's brand, whatever became of it, or null if none was made. */
    keptBrand(projectId: string): Promise<Result<KeptBrand | null>>;
    /** The client's owner's answer. Approving needs a fresh proof of who is deciding. */
    decideKeptBrand(proposalId: string, approve: boolean): Promise<Result>;
  };
  runs: {
    /** Newest first. */
    list(projectId: string): Promise<Result<RunView[]>>;
    budget(projectId: string): Promise<Result<BudgetView | null>>;
    pause(projectId: string, note?: string): Promise<Result>;
    resume(projectId: string): Promise<Result>;
    cancel(projectId: string, note?: string): Promise<Result>;
  };
  /** What stopped work is waiting for a person to answer. The API sends each person only what is asked of them. */
  questions: {
    list(opts?: { projectId?: string }): Promise<Result<Question[]>>;
    answer(questionId: string, answer: Answer): Promise<Result>;
  };
  /**
   * What people are told (CC-5). A brief is written from records and every statement names the records it comes from, so the
   * reader can open them; what is not known says "not recorded." A client reads only what was written to their organization.
   */
  briefs: {
    /** Newest first. */
    list(opts?: { projectId?: string; type?: BriefType }): Promise<Result<BriefSummary[]>>;
    get(id: string): Promise<Result<BriefDoc>>;
    /** Opens every source and reports whether each statement still says what its record says. */
    verify(id: string): Promise<Result<BriefCheck>>;
  };
  /** How the signed-in person wants to be told, and what has been sent or is waiting. Always their own. */
  /**
   * The CEO's Settings (P6.21): how the agency runs (read only), its fee and rate card, what paid models may spend, and where the
   * person is signed in. Changing money (the fee, a rate, the envelope) needs a fresh proof; v4 refuses otherwise, and it never
   * reaches a client.
   */
  settings: {
    system(): Promise<Result<SystemView>>;
    fees(): Promise<Result<FeesView>>;
    setFeePolicy(input: { agencyFeePct: number; scope: FeeScope }): Promise<Result>;
    /** Removes a client's or a project's own fee; the agency-wide fee is changed, never removed. */
    clearFeePolicy(scope: Exclude<FeeScope, { kind: "agency" }>): Promise<Result>;
    setRate(input: { capability: string; rigor: Rigor; unitUsd: number }): Promise<Result>;
    removeRate(input: { capability: string; rigor: Rigor }): Promise<Result>;
    spend(): Promise<Result<SpendView>>;
    setSpendPolicy(input: { monthlyCeilingUsd: number; perCallCeilingUsd: number }): Promise<Result>;
    sessions(): Promise<Result<SessionView[]>>;
    endSession(id: string): Promise<Result>;
  };
  notifications: {
    list(): Promise<Result<NotificationItem[]>>;
    preferences(): Promise<Result<NotificationPrefs>>;
    savePreferences(prefs: NotificationPrefs): Promise<Result<NotificationPrefs>>;
  };
  /**
   * Answering one low-consequence question from an email, without signing in. Looking never changes anything (a mail scanner may
   * open the link); only a separate confirmation answers, once.
   */
  actionLinks: {
    describe(token: string): Promise<Result<ActionLinkView>>;
    confirm(token: string): Promise<Result<{ option: ActionLinkView["option"] }>>;
  };
  /** The tamper-evident record of what was decided for a client: each entry is sealed to the one before it. */
  audit: {
    chain(organizationId: string): Promise<Result<AuditChain>>;
  };
  /**
   * Standing permission: what the agency may do for a client without asking each time, for a limited time. It covers only the kinds of
   * work it names, never anything above risk 3, hard to undo or consequential (publishing, sending, deleting, paying), and no extra
   * spend. The client's owner grants it (with a fresh proof); it can be taken back at any time through `plans.revokeDelegation`.
   */
  standing: {
    list(organizationId: string): Promise<Result<DelegationView[]>>;
    grant(input: { organizationId: string; scopes: string[]; validDays: number }): Promise<Result<DelegationView>>;
  };
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
    /** What the client reads about a plan, ordered and trimmed by v4 (P6.20): no internal work. */
    clientView(proposalId: string): Promise<Result<ClientPlanView>>;
    /**
     * The client's owner lets the agency's CEO approve routine decisions on one project (ADR-0015): a standing permission, with
     * a fresh proof. Anything above risk 3, spending beyond what was approved, and anything irreversible still come to them.
     */
    allowAgencyToDecide(input: { organizationId: string; projectId: string }): Promise<Result>;
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
