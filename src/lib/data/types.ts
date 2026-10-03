import type { AppRole, Asset, AssetKind, ClientData, OrgRole, OwnerData, Session } from "../model";

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

export type DirectiveInput = {
  content: string;
  projectId: string | null;
  organizationId: string | null;
};

export type AssetUploadInput = {
  organizationId: string;
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

    // Intent. Projects begin only here (or from a client's own intent); there is no create-project command.
    issueDirective(input: DirectiveInput): Promise<Result>;

    /** Marks the CEO's visit and returns when they were last here (ISO), or null. */
    markSeen(): Promise<string | null>;

    // Organizations and people
    createOrganization(input: { name: string; mission: string | null }): Promise<Result>;
    invitePerson(input: { organizationId: string; email: string; role: OrgRole }): Promise<Result>;
    removePerson(organizationId: string, userId: string): Promise<Result>;

    postUpdate(projectId: string, input: { summary: string; share: boolean }): Promise<Result>;
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
