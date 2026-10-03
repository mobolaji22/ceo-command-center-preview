import type { Asset, ClientData, OwnerData, Session } from "../model";
import { fail, ok, type DataSource, type Result } from "./types";

/**
 * API DataSource: the dev-playbook-v4 API, reached only through this app's own server.
 *
 * The browser never talks to v4 and never holds a credential. Every call below goes to `/api/...` on this origin; a
 * Next.js route handler (the backend-for-frontend, `src/app/api`) reads the session from an httpOnly cookie and forwards
 * the request. See docs/INTEGRATION.md for the endpoint map and the rules the proxy enforces.
 */

const PROXY = "/api/v4";

/** What the API says, in words a person can act on. Unknown codes fall back to the code itself. */
const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Your session has ended. Please sign in again.",
  FORBIDDEN: "You don't have access to do that.",
  STEP_UP_REQUIRED: "For safety, please confirm it's you first.",
  INVALID_OR_EXPIRED: "That link or code has expired or was already used. Ask for a new one.",
  PERMISSION_REQUIRED: "This is the client's decision. You can make it only if their owner has given you permission.",
  APPROVAL_ALREADY_RESOLVED: "This was already decided.",
  NOT_SCANNED: "This file hasn't passed its safety scan, so it can't be downloaded.",
  UNSUPPORTED_TYPE: "That type of file isn't accepted.",
  TOO_LARGE: "That file is too large.",
  ASSET_NOT_FOUND: "That file couldn't be found.",
  ALREADY_PROMOTED: "This file is already in the organization library.",
  INVALID_EMAIL: "That doesn't look like an email address.",
  INVALID_BODY: "Some of what you entered isn't valid.",
  NOT_FOUND: "That couldn't be found.",
};

async function request<T>(url: string, init: RequestInit): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "same-origin", ...init });
  } catch {
    return fail("Could not reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return ok(undefined as T);
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  if (!res.ok) {
    const code = (json as { error?: unknown } | null)?.error;
    if (typeof code === "string") return fail(MESSAGES[code] ?? code.replace(/_/g, " ").toLowerCase(), code);
    return fail(`Request failed (${res.status}).`);
  }
  return ok(json as T);
}

const call = <T>(method: string, path: string, body?: unknown, base = PROXY): Promise<Result<T>> =>
  request<T>(`${base}${path}`, {
    method,
    headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

const must = <T>(r: Result<T>): T => {
  if (r.error || r.data === null) throw new Error(r.error?.message ?? "Empty response.");
  return r.data;
};
const voidResult = (r: Result<unknown>): Result => (r.error ? { data: null, error: r.error } : ok(undefined as void));

type ApiAsset = {
  id: string; organizationId: string; scope: "ORGANIZATION" | "PROJECT"; projectId: string | null; kind: string; name: string;
  provenance: string; rights: string; createdAt: string;
  versions: Array<{ version: number; mime: string; sizeBytes: number; scanStatus: Asset["versions"][number]["scan_status"]; scanDetail?: string | null; createdAt: string }>;
};
const toAsset = (a: ApiAsset): Asset => ({
  id: a.id, organization_id: a.organizationId, scope: a.scope, project_id: a.projectId, kind: a.kind, name: a.name,
  provenance: a.provenance, rights: a.rights, created_at: a.createdAt,
  versions: a.versions.map((v) => ({ version: v.version, mime: v.mime, size_bytes: v.sizeBytes, scan_status: v.scanStatus, scan_detail: v.scanDetail ?? null, created_at: v.createdAt })),
});

const pathOf = (url: string) => new URL(url, "http://localhost").pathname;

export function createApiDataSource(): DataSource {
  const session = async (r: Promise<Result<{ session: Session | null }>>): Promise<Result<Session>> => {
    const res = await r;
    if (res.error) return { data: null, error: res.error };
    if (!res.data?.session) return fail(MESSAGES["INVALID_OR_EXPIRED"]!, "INVALID_OR_EXPIRED");
    notify();
    return ok(res.data.session);
  };

  return {
    kind: "api",
    capabilities: { approvalNotes: false, timelineUpdates: false },

    auth: {
      async getSession() {
        const r = await call<{ session: Session | null }>("GET", "/session", undefined, "/api");
        return r.data?.session ?? null;
      },
      async requestSignIn(email) {
        return voidResult(await call("POST", "/auth/request", { email }, "/api"));
      },
      verifyLink: (token) => session(call("POST", "/auth/verify", { token }, "/api")),
      verifyCode: (email, code) => session(call("POST", "/auth/verify", { email, code }, "/api")),
      acceptInvitation: (token) => session(call("POST", "/auth/accept", { token }, "/api")),
      async requestStepUp() {
        return voidResult(await call("POST", "/v1/auth/step-up/request"));
      },
      async verifyStepUp(code) {
        return voidResult(await call("POST", "/v1/auth/step-up/verify", { code }));
      },
      async signOut() {
        await call("POST", "/auth/sign-out", undefined, "/api");
        notify();
      },
      subscribe(onChange) {
        // Another tab signing in or out reaches this one through the browser's broadcast channel.
        const ch = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
        ch?.addEventListener("message", onChange);
        return () => ch?.close();
      },
    },

    queries: {
      async ownerData() {
        return must(await call<OwnerData>("GET", "/v1/console/overview"));
      },
      async clientData() {
        return must(await call<ClientData>("GET", "/v1/portal/overview"));
      },
    },

    commands: {
      async resolveApproval(id, approved) {
        return voidResult(await call("POST", `/v1/approvals/${id}/resolve`, { approved }));
      },
      async setApprovalConstraints() {
        return fail("Constraints on an authorization arrive with the intervention flow.");
      },
      async requestApprovalEvidence() {
        return fail("Evidence requests arrive with the intervention flow.");
      },
      async clientResolveApproval(id, approved) {
        return voidResult(await call("POST", `/v1/approvals/${id}/resolve`, { approved }));
      },

      async issueDirective(input) {
        return voidResult(await call("POST", "/v1/directives", {
          rawInput: input.content,
          ...(input.projectId ? { projectId: input.projectId } : {}),
          ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        }));
      },

      async markSeen() {
        const r = await call<{ since: string | null }>("POST", "/v1/console/seen");
        return r.data?.since ?? null;
      },

      async createOrganization(input) {
        return voidResult(await call("POST", "/v1/organizations", input));
      },
      async invitePerson(input) {
        return voidResult(await call("POST", "/v1/invitations", input));
      },
      async removePerson(organizationId, userId) {
        return voidResult(await call("DELETE", `/v1/organizations/${organizationId}/members/${userId}`));
      },
      async postUpdate() {
        return fail("Timeline updates are written by the system, not by hand.");
      },
    },

    assets: {
      async list({ organizationId, projectId }) {
        const q = new URLSearchParams({ organizationId, ...(projectId ? { projectId } : {}) });
        const r = await call<ApiAsset[]>("GET", `/v1/assets?${q}`);
        return r.error || !r.data ? { data: null, error: r.error } : ok(r.data.map(toAsset));
      },

      async upload(input) {
        const mime = input.file.type || "application/octet-stream";
        const started = await call<{ asset: { id: string }; version: { version: number }; upload: { url: string; headers: Record<string, string>; direct: boolean } }>("POST", "/v1/assets", {
          organizationId: input.organizationId, scope: input.scope, ...(input.projectId ? { projectId: input.projectId } : {}),
          kind: input.kind, name: input.name, provenance: input.provenance, rights: input.rights, mime, sizeBytes: input.file.size,
        });
        if (started.error || !started.data) return { data: null, error: started.error };
        const { asset, version, upload } = started.data;
        // The bytes go to the signed link and never touch the API's handlers. A link to the object store (production) is used
        // as is; a link to the API itself (development storage) goes through this app's server.
        const sent = await request<void>(upload.direct ? upload.url : `${PROXY}${pathOf(upload.url)}`, { method: "PUT", headers: { "Content-Type": upload.headers["content-type"] ?? mime }, body: input.file });
        if (sent.error) return { data: null, error: sent.error };
        const done = await call<{ scanStatus: string; scanDetail: string | null }>("POST", `/v1/assets/${asset.id}/versions/${version.version}/complete`);
        if (done.error) return { data: null, error: done.error };
        if (done.data && done.data.scanStatus !== "CLEAN") {
          return fail(`The file was not accepted: ${done.data.scanDetail ?? done.data.scanStatus}`, "SCAN_" + done.data.scanStatus);
        }
        const full = await call<ApiAsset>("GET", `/v1/assets/${asset.id}`);
        return full.error || !full.data ? { data: null, error: full.error } : ok(toAsset(full.data));
      },

      async downloadLink(assetId) {
        const r = await call<{ url: string; direct: boolean }>("GET", `/v1/assets/${assetId}/download`);
        return r.error || !r.data ? { data: null, error: r.error } : ok({ url: r.data.direct ? r.data.url : `${PROXY}${pathOf(r.data.url)}` });
      },
      async promote(assetId) {
        return voidResult(await call("POST", `/v1/assets/${assetId}/promote`));
      },
      async exclude(projectId, assetId) {
        return voidResult(await call("POST", `/v1/projects/${projectId}/assets/${assetId}/exclude`));
      },
    },
  };
}

const CHANNEL = "dpb-session";
function notify() {
  if (typeof BroadcastChannel === "undefined") return;
  const ch = new BroadcastChannel(CHANNEL);
  ch.postMessage("changed");
  ch.close();
}
