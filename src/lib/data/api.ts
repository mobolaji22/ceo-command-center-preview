import type { Asset, ClientData, DecisionEntry, DelegationView, OwnerData, PlanContent, PlanVersion, Session } from "../model";
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

type ApiPlan = {
  objective: string; scope: { in: string[]; out: string[] }; deliverables: PlanContent["deliverables"];
  successMetrics: Array<{ id: string; metric: string; baseline: string | null; target: string; measurement: string; window: string; dataSource: string }>;
  tasks: Array<{ id: string; title: string; domain: string; capability: string; rigor: string; risk: number; reversibility: number; dependsOn: string[] }>;
  milestones: Array<{ name: string; afterTasks: string[] }>; budget: { lowUsd: number; highUsd: number; confidence: number };
  risks: PlanContent["risks"]; assumptions: string[]; openContextNeeds: string[]; decisionPoints: Array<{ taskId?: string; description: string }>;
};
type ApiProposal = {
  id: string; projectId: string; organizationId: string; type: string; version: number; status: PlanVersion["status"]; decisionOwner: PlanVersion["decision_owner"];
  impact: number; reversibility: number; rationale: string | null; submittedAt: string | null; decidedAt: string | null; decision: PlanVersion["decision"];
  decisionNote: string | null; onBehalfPermissionId: string | null; content: ApiPlan;
};
const toPlan = (c: ApiPlan): PlanContent => ({
  objective: c.objective, scope_in: c.scope.in, scope_out: c.scope.out, deliverables: c.deliverables,
  success_metrics: c.successMetrics.map((m) => ({ id: m.id, metric: m.metric, baseline: m.baseline, target: m.target, measurement: m.measurement, window: m.window, data_source: m.dataSource })),
  tasks: c.tasks.map((t) => ({ id: t.id, title: t.title, domain: t.domain, capability: t.capability, rigor: t.rigor, risk: t.risk, reversibility: t.reversibility, depends_on: t.dependsOn })),
  milestones: c.milestones.map((m) => ({ name: m.name, after_tasks: m.afterTasks })),
  budget: { low_usd: c.budget.lowUsd, high_usd: c.budget.highUsd, confidence: c.budget.confidence },
  risks: c.risks, assumptions: c.assumptions, open_context_needs: c.openContextNeeds,
  decision_points: c.decisionPoints.map((d) => ({ task_id: d.taskId ?? null, description: d.description })),
});
const toPlanVersion = (p: ApiProposal): PlanVersion => ({
  id: p.id, project_id: p.projectId, organization_id: p.organizationId, version: p.version, status: p.status, decision_owner: p.decisionOwner,
  impact: p.impact, reversibility: p.reversibility, rationale: p.rationale, submitted_at: p.submittedAt, decided_at: p.decidedAt, decision: p.decision,
  decision_note: p.decisionNote, on_behalf: p.onBehalfPermissionId !== null, plan: toPlan(p.content),
});

const pathOf = (url: string) => new URL(url, "http://localhost").pathname;

/** Uploads a file as a draft (set aside, nobody else's, placed when a request is submitted) and returns its id once it has passed its scan. */
async function stageFile(organizationId: string, file: File, provenance: string): Promise<Result<string>> {
  const mime = file.type || "application/octet-stream";
  const started = await call<{ asset: { id: string }; version: { version: number }; upload: { url: string; headers: Record<string, string>; direct: boolean } }>("POST", "/v1/assets", {
    organizationId, scope: "PROJECT", staged: true, kind: kindFor(mime), name: file.name, provenance, rights: "OWNED_BY_CLIENT", mime, sizeBytes: file.size,
  });
  if (started.error || !started.data) return { data: null, error: started.error };
  const { asset, version, upload } = started.data;
  const sent = await request<void>(upload.direct ? upload.url : `${PROXY}${pathOf(upload.url)}`, { method: "PUT", headers: { "Content-Type": upload.headers["content-type"] ?? mime }, body: file });
  if (sent.error) return { data: null, error: sent.error };
  const done = await call<{ scanStatus: string; scanDetail: string | null }>("POST", `/v1/assets/${asset.id}/versions/${version.version}/complete`);
  if (done.error) return { data: null, error: done.error };
  if (done.data && done.data.scanStatus !== "CLEAN") return fail(`"${file.name}" was not accepted: ${done.data.scanDetail ?? done.data.scanStatus}`, "SCAN_" + done.data.scanStatus);
  return ok(asset.id);
}

const kindFor = (mime: string) => (mime.startsWith("image/") ? "IMAGE" : mime.startsWith("audio/") ? "AUDIO" : mime.startsWith("video/") ? "VIDEO" : "DOCUMENT");

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

    intents: {
      async submit(input) {
        const me = await call<{ isCEO: boolean; isAgency: boolean }>("GET", "/v1/me");
        const provenance = me.data?.isAgency ? "CEO_PROVIDED" : "CLIENT_PROVIDED";
        const placed: Array<{ assetId: string; scope: "PROJECT" | "ORGANIZATION" }> = [];
        for (const a of input.attachments) {
          if (a.kind === "file") {
            const r = await stageFile(input.organizationId, a.file, provenance);
            if (r.error || !r.data) return { data: null, error: r.error };
            placed.push({ assetId: r.data, scope: a.scope });
          } else {
            const r = await call<{ id: string }>("POST", "/v1/assets/pointers", {
              organizationId: input.organizationId, kind: "URL_REFERENCE", name: a.url.slice(0, 200), url: a.url, scope: "PROJECT", staged: true, provenance, rights: "THIRD_PARTY_UNCLEARED",
            });
            if (r.error || !r.data) return { data: null, error: r.error };
            placed.push({ assetId: r.data.id, scope: a.scope });
          }
        }
        const r = await call<{ status: string; projectId: string | null }>("POST", "/v1/intents", { organizationId: input.organizationId, text: input.text, attachments: placed });
        return r.error || !r.data ? { data: null, error: r.error } : ok({ status: r.data.status, projectId: r.data.projectId });
      },
      async answer(intentId, clarificationId, answer) {
        return voidResult(await call("POST", `/v1/intents/${intentId}/clarifications/${clarificationId}/answer`, answer));
      },
      async respond(requirementId, answer, organizationId) {
        if (answer.action === "UPLOAD") {
          const me = await call<{ isAgency: boolean }>("GET", "/v1/me");
          const staged = await stageFile(organizationId, answer.file, me.data?.isAgency ? "CEO_PROVIDED" : "CLIENT_PROVIDED");
          if (staged.error || !staged.data) return { data: null, error: staged.error };
          return voidResult(await call("POST", `/v1/requirements/${requirementId}/respond`, { action: "UPLOAD", assetId: staged.data }));
        }
        return voidResult(await call("POST", `/v1/requirements/${requirementId}/respond`, answer));
      },
    },

    plans: {
      async list(projectId) {
        const r = await call<ApiProposal[]>("GET", `/v1/projects/${projectId}/proposals`);
        return r.error || !r.data ? { data: null, error: r.error } : ok(r.data.filter((p) => p.type === "PLAN").map(toPlanVersion));
      },
      async changes(proposalId) {
        const r = await call<{ from: { version: number }; to: { version: number }; diff: { summary: string[]; unchanged: boolean; budget: { from: { lowUsd: number; highUsd: number }; to: { lowUsd: number; highUsd: number } } | null } }>("GET", `/v1/proposals/${proposalId}/diff`);
        if (r.error || !r.data) return { data: null, error: r.error };
        const { diff } = r.data;
        return ok({
          from_version: r.data.from.version, to_version: r.data.to.version, summary: diff.summary, unchanged: diff.unchanged,
          budget: diff.budget ? { from_low: diff.budget.from.lowUsd, from_high: diff.budget.from.highUsd, to_low: diff.budget.to.lowUsd, to_high: diff.budget.to.highUsd } : null,
        });
      },
      async decide(proposalId, decision) {
        const r = await call<{ revision: { version: number } | null }>("POST", `/v1/proposals/${proposalId}/decision`, decision);
        return r.error || !r.data ? { data: null, error: r.error } : ok({ nextVersion: r.data.revision?.version ?? null });
      },
      async decisions(projectId) {
        const r = await call<Array<{ proposalId: string; version: number; decision: DecisionEntry["decision"]; decidedByRole: DecisionEntry["decided_by_role"]; onBehalf: boolean; note: string | null; decidedAt: string }>>("GET", `/v1/projects/${projectId}/decisions`);
        return r.error || !r.data ? { data: null, error: r.error } : ok(r.data.map((d) => ({ proposal_id: d.proposalId, version: d.version, decision: d.decision, decided_by_role: d.decidedByRole, on_behalf: d.onBehalf, note: d.note, decided_at: d.decidedAt })));
      },
      async delegations(projectId) {
        const r = await call<Array<{ id: string; proposalId: string; approvalLevel: string; maxAutonomyMode: number; maxRisk: number; allowedScopes: string[]; budgetMaxCostUsd: number | null; onBehalfPermissionId: string | null; createdAt: string; revokedAt: string | null; revokedReason: string | null }>>("GET", `/v1/projects/${projectId}/delegations`);
        return r.error || !r.data ? { data: null, error: r.error } : ok(r.data.map((d): DelegationView => ({
          id: d.id, proposal_id: d.proposalId, approval_level: d.approvalLevel, max_autonomy_mode: d.maxAutonomyMode, scopes: d.allowedScopes, max_risk: d.maxRisk,
          budget_max_usd: d.budgetMaxCostUsd, on_behalf: d.onBehalfPermissionId !== null, created_at: d.createdAt, revoked_at: d.revokedAt, revoked_reason: d.revokedReason,
        })));
      },
      async revokeDelegation(delegationId, reason) {
        return voidResult(await call("POST", `/v1/delegations/${delegationId}/revoke`, { reason }));
      },
      async mayDecideForClient(plan) {
        const r = await call<Array<{ status: string; scope: string; projectId: string | null; proposalId: string | null; expiresAt: string | null; usedAt: string | null }>>("GET", `/v1/organizations/${plan.organization_id}/permissions`);
        if (r.error || !r.data) return false;
        const now = Date.now();
        // A standing permission never covers a plan of risk above 3 (the API's own limit); a single-decision one names this plan.
        return r.data.some((p) => p.status === "ACTIVE" && (!p.expiresAt || new Date(p.expiresAt).getTime() > now)
          && (p.scope === "DECISION" ? p.proposalId === plan.id && !p.usedAt : (p.projectId === null || p.projectId === plan.project_id) && plan.impact <= 3));
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
