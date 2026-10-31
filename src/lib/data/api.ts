import type { SddDocument, SddView } from "@/lib/design/v4";
import type { ClientBookView, KeptBrand } from "@/lib/deliverables/v4";
import type { ActionLinkView, AuditChain, Asset, ClientIntentView, ClientPlanView, MaterialWay, BriefDoc, BriefSummary, BriefType, BudgetView, ClientData, DecisionEntry, DelegationView, DomainView, OwnerData, NotificationItem, NotificationPrefs, PlanContent, PlanVersion, Question, RunTask, RunView, Session, FeeScope, FeesView, Rigor, SessionView, SpendView, SystemView } from "../model";
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
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable. Please try again in a moment.",
  SERVER_ERROR: "We couldn't complete that request. Please try again shortly.",
  FORBIDDEN: "You don't have access to do that.",
  STEP_UP_REQUIRED: "For safety, please confirm it's you first.",
  INVALID_OR_EXPIRED: "That link or code has expired or was already used. Ask for a new one.",
  NO_LIVE_RUN: "There is no work under way to do that to.",
  ALREADY_PAUSED: "The work is already paused.",
  ALREADY_STOPPED: "The work is already waiting for an answer. Answer that instead.",
  NOT_PAUSED: "The work is not paused.",
  ALREADY_RESOLVED: "This was already answered.",
  INVALID_OPTION: "That is not one of the answers offered.",
  INVALID_PARAMS: "Something needed for that answer is missing or not valid.",
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
  ALREADY_USED: "This link has already been used.",
  ALREADY_ANSWERED: "This was already answered.",
  EXPIRED: "This link has expired.",
  DRAFT_CONFLICT: "Someone else saved a newer version of this design. Reload to see it.",
  STALE_BASE: "A newer version of this design was approved since this draft began. Reload to work from it.",
  AWAITING_DECISION: "This revision is waiting for a decision, so it cannot change. Ask for a change in the decision instead.",
  OPEN_CHANGE_REQUEST: "A change the client asked for is still open. Answer it before this revision can be approved.",
  ANNOTATIONS_ARE_APPENDED: "Feedback is added and answered on its own, never in a save. Reload and try again.",
  INTERVENTION_NOT_FOUND: "That couldn't be found.",
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
    if (typeof code === "string") {
      // When the API says exactly what was wrong with what was sent, say that rather than the general sentence.
      const issue = code === "INVALID_BODY" ? (json as { issues?: Array<{ message?: unknown }> } | null)?.issues?.[0]?.message : undefined;
      // A refusal v4 explains in a sentence (what in a design document does not hold) is passed on when there is no sentence here.
      const detail = (json as { detail?: unknown } | null)?.detail;
      return fail(typeof issue === "string" && issue ? `${issue.replace(/\.$/, "")}.` : MESSAGES[code] ?? (typeof detail === "string" && detail ? detail : code.replace(/_/g, " ").toLowerCase()), code);
    }
    if (res.status >= 500) return fail(MESSAGES["SERVER_ERROR"]!, "SERVER_ERROR");
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

/** v4 names a fee policy's scope as `agency`, `org:<id>` or `project:<id>`. */
const toFeeScope = (s: string): FeeScope => (s.startsWith("org:") ? { kind: "organization", id: s.slice(4) } : s.startsWith("project:") ? { kind: "project", id: s.slice(8) } : { kind: "agency" });
const scopeParams = (s: Exclude<FeeScope, { kind: "agency" }>) => (s.kind === "organization" ? `organizationId=${encodeURIComponent(s.id)}` : `projectId=${encodeURIComponent(s.id)}`);

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
  phasing?: Array<{ taskId: string; upstream: string; reason: string }>;
  engagement?: { unstaffed?: string[]; exempt?: PlanContent["exempt"] };
};
type ApiProposal = {
  id: string; projectId: string; organizationId: string; type: string; version: number; status: PlanVersion["status"]; decisionOwner: PlanVersion["decision_owner"];
  impact: number; reversibility: number; rationale: string | null; submittedAt: string | null; decidedAt: string | null; decision: PlanVersion["decision"];
  decisionNote: string | null; onBehalfPermissionId: string | null; content: ApiPlan;
};
type ApiRun = { id: string; projectId: string; status: RunView["status"]; waitReason: string | null; planVersion: number; closeReason: string | null; startedAt: string; endedAt: string | null };
type ApiRunTask = { id: string; planTaskId: string | null; title: string; domain: string; status: RunTask["status"]; waitReason: string | null; dependencies: string[]; staleAt: string | null };
const toRunTask = (t: ApiRunTask): RunTask => ({ id: t.id, plan_task_id: t.planTaskId ?? t.id, title: t.title, domain: t.domain, status: t.status, wait_reason: t.waitReason, depends_on: t.dependencies, stale: t.staleAt !== null });
type ApiQuestion = {
  id: string; projectId: string; organizationId: string; runId: string; taskId: string | null; reason: string; routedTo: Question["routed_to"]; status: Question["status"];
  title: string; summary: string; detail?: string | null; options: Array<{ id: string; stepUp?: boolean }>; recommendation: { option: string; why: string } | null; deadline: string | null; createdAt: string;
};
type ApiBrief = { id: string; organizationId: string; projectId: string | null; type: BriefType; audience: "CLIENT" | "AGENCY"; title: string; attentionLevel: number; compiledAt: string };
type ApiCitation = { type: string; id?: string; ids?: string[]; path?: string; expect?: string | number; expectSum?: number };
type ApiPrefs = { timezone: string; quietHours: { start: string; end: string } | null; minInterruptLevel: number; emailEnabled: boolean; digest: NotificationPrefs["digest"] };
const toBrief = (b: ApiBrief): BriefSummary => ({ id: b.id, organization_id: b.organizationId, project_id: b.projectId, type: b.type, audience: b.audience, title: b.title, level: b.attentionLevel, created_at: b.compiledAt });
const toPrefs = (p: ApiPrefs): NotificationPrefs => ({ timezone: p.timezone, quiet_hours: p.quietHours, min_interrupt_level: p.minInterruptLevel, email_enabled: p.emailEnabled, digest: p.digest });
type ApiDelegation = { id: string; organizationId: string; basis: DelegationView["basis"]; proposalId: string | null; projectId: string | null; expiresAt: string | null; approvalLevel: string; maxAutonomyMode: number; maxRisk: number; allowedScopes: string[]; budgetMaxCostUsd: number | null; onBehalfPermissionId: string | null; createdAt: string; revokedAt: string | null; revokedReason: string | null };
const toDelegation = (d: ApiDelegation): DelegationView => ({
  id: d.id, basis: d.basis, organization_id: d.organizationId, proposal_id: d.proposalId, project_id: d.projectId, expires_at: d.expiresAt, approval_level: d.approvalLevel, max_autonomy_mode: d.maxAutonomyMode,
  scopes: d.allowedScopes, max_risk: d.maxRisk, budget_max_usd: d.budgetMaxCostUsd, on_behalf: d.onBehalfPermissionId !== null, created_at: d.createdAt, revoked_at: d.revokedAt, revoked_reason: d.revokedReason,
});
const toQuestion = (q: ApiQuestion): Question => ({
  id: q.id, project_id: q.projectId, organization_id: q.organizationId, run_id: q.runId, task_id: q.taskId, reason: q.reason, routed_to: q.routedTo, status: q.status,
  title: q.title, summary: q.summary, detail: q.detail ?? null, options: q.options.map((o) => ({ id: o.id, stepUp: o.stepUp === true })), recommendation: q.recommendation, deadline: q.deadline, created_at: q.createdAt,
});

const toPlan = (c: ApiPlan): PlanContent => ({
  objective: c.objective, scope_in: c.scope.in, scope_out: c.scope.out, deliverables: c.deliverables,
  success_metrics: c.successMetrics.map((m) => ({ id: m.id, metric: m.metric, baseline: m.baseline, target: m.target, measurement: m.measurement, window: m.window, data_source: m.dataSource })),
  tasks: c.tasks.map((t) => ({ id: t.id, title: t.title, domain: t.domain, capability: t.capability, rigor: t.rigor, risk: t.risk, reversibility: t.reversibility, depends_on: t.dependsOn })),
  milestones: c.milestones.map((m) => ({ name: m.name, after_tasks: m.afterTasks })),
  budget: { low_usd: c.budget.lowUsd, high_usd: c.budget.highUsd, confidence: c.budget.confidence },
  risks: c.risks, assumptions: c.assumptions, open_context_needs: c.openContextNeeds,
  decision_points: c.decisionPoints.map((d) => ({ task_id: d.taskId ?? null, description: d.description })),
  phasing: (c.phasing ?? []).map((x) => ({ task_id: x.taskId, upstream: x.upstream, reason: x.reason })),
  unstaffed: c.engagement?.unstaffed ?? [], exempt: c.engagement?.exempt ?? [],
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
      async domains() {
        return must(await call<{ domains: DomainView[] }>("GET", "/v1/domains")).domains;
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
        // No client named: the agency's own work. Its organization is asked for first, so attachments have somewhere to be staged.
        let organizationId = input.organizationId;
        if (organizationId === null) {
          const own = await call<{ id: string }>("POST", "/v1/organizations/internal");
          if (own.error || !own.data) return { data: null, error: own.error };
          organizationId = own.data.id;
        }
        const placed: Array<{ assetId: string; scope: "PROJECT" | "ORGANIZATION" }> = [];
        for (const a of input.attachments) {
          if (a.kind === "file") {
            const r = await stageFile(organizationId, a.file, provenance);
            if (r.error || !r.data) return { data: null, error: r.error };
            placed.push({ assetId: r.data, scope: a.scope });
          } else {
            const r = await call<{ id: string }>("POST", "/v1/assets/pointers", {
              organizationId, kind: "URL_REFERENCE", name: a.url.slice(0, 200), url: a.url, scope: "PROJECT", staged: true, provenance, rights: "THIRD_PARTY_UNCLEARED",
            });
            if (r.error || !r.data) return { data: null, error: r.error };
            placed.push({ assetId: r.data.id, scope: a.scope });
          }
        }
        const r = await call<{ id: string; status: string; projectId: string | null }>("POST", "/v1/intents", { organizationId, text: input.text, attachments: placed });
        return r.error || !r.data ? { data: null, error: r.error } : ok({ intentId: r.data.id, status: r.data.status, projectId: r.data.projectId });
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
      async clientView(intentId) {
        type Need = { id: string; name: string; why: string; ifMissing: string; ways: MaterialWay[]; sourcing: boolean };
        const r = await call<{
          id: string; text: string; createdAt: string; status: ClientIntentView["status"];
          questions: Array<{ id: string; position: number; of: number; question: string; why: string; options: Array<{ id: string; label: string; tradeoff: string }>; defaultOptionId: string | null }>;
          needs: { required: Need[]; optional: Need[] }; assumed: Array<{ id: string; question: string; answer: string }>; plan: ClientIntentView["plan"];
        }>("GET", `/v1/intents/${intentId}/client-view`);
        if (r.error || !r.data) return { data: null, error: r.error };
        const need = (n: Need) => ({ requirement_id: n.id, name: n.name, why: n.why, if_missing: n.ifMissing, ways: n.ways, sourcing: n.sourcing });
        const v = r.data;
        return ok({
          id: v.id, text: v.text, created_at: v.createdAt, status: v.status,
          questions: v.questions.map((q) => ({ id: q.id, position: q.position, of: q.of, question: q.question, why: q.why, options: q.options, default_option_id: q.defaultOptionId })),
          needs: { required: v.needs.required.map(need), optional: v.needs.optional.map(need) }, assumed: v.assumed, plan: v.plan,
        });
      },
    },

    design: {
      async read(projectId) {
        const r = await call<SddView & { annotations?: SddView["annotations"] }>("GET", `/v1/projects/${encodeURIComponent(projectId)}/sdd`);
        return r.error || !r.data ? { data: null, error: r.error } : ok({ approved: r.data.approved, current: r.data.current, annotations: r.data.annotations ?? [] });
      },
      async selectTerritory(projectId, territoryId, changes) {
        const r = await call<unknown>("POST", `/v1/projects/${encodeURIComponent(projectId)}/sdd/territories/${encodeURIComponent(territoryId)}/select`, changes?.trim() ? { changes: changes.trim() } : {});
        return r.error ? { data: null, error: r.error } : ok(undefined);
      },
      async save(projectId, document, expectedHash) {
        // What the platform stamps (the project, tenant, revision and status) is v4's, so it is not sent.
        const { projectId: _p, tenantId: _t, revision: _r, status: _s, ...edit } = document;
        const r = await call<{ content: { documentHash: string } }>("PUT", `/v1/projects/${encodeURIComponent(projectId)}/sdd/draft`, { document: edit, expectedHash });
        return r.error || !r.data ? { data: null, error: r.error } : ok({ documentHash: r.data.content.documentHash });
      },
      submit: async (projectId, documentHash) => voidResult(await call("POST", `/v1/projects/${encodeURIComponent(projectId)}/sdd/draft/submit`, { documentHash })),
      async versions(projectId) {
        const r = await call<Array<{ version: number; approvedAt: string; approvedById: string }>>("GET", `/v1/projects/${encodeURIComponent(projectId)}/sdd/versions`);
        return r.error || !r.data ? { data: null, error: r.error } : ok(r.data.map((v) => ({ version: v.version, approvedAt: v.approvedAt, approvedById: v.approvedById })));
      },
      version: (projectId, version) => call<SddDocument>("GET", `/v1/projects/${encodeURIComponent(projectId)}/sdd/versions/${version}`),
      annotate: (projectId, input) => call("POST", `/v1/projects/${encodeURIComponent(projectId)}/sdd/annotations`, { target: { kind: input.target.kind, id: input.target.id }, kind: input.kind, text: input.text }),
      settle: (projectId, annotationId, input) => call("POST", `/v1/projects/${encodeURIComponent(projectId)}/sdd/annotations/${encodeURIComponent(annotationId)}/settle`, input),
      decide: async (proposalId, input) => voidResult(await call("POST", `/v1/proposals/${encodeURIComponent(proposalId)}/decision`, input)),
    },

    deliverables: {
      async book(projectId) {
        const r = await call<ClientBookView>("GET", `/v1/projects/${encodeURIComponent(projectId)}/book`);
        // "Not produced" is an answer, not a failure: there is no part this reader may read yet.
        return r.error?.code === "NOT_PRODUCED" ? ok(null) : r;
      },
      async keepBrand(projectId) {
        const r = await call<{ proposalId: string; written: boolean }>("POST", `/v1/projects/${encodeURIComponent(projectId)}/brand/keep`);
        return r.error || !r.data ? { data: null, error: r.error } : ok({ proposalId: r.data.proposalId, written: r.data.written });
      },
      async keptBrand(projectId) {
        type ApiProposal = { id: string; type: string; status: KeptBrand["status"] | "DRAFT"; content: unknown; submittedAt: string | null; decidedAt: string | null; createdAt: string };
        const r = await call<ApiProposal[]>("GET", `/v1/projects/${encodeURIComponent(projectId)}/proposals`);
        if (r.error || !r.data) return { data: null, error: r.error };
        // The proposals to let a kept Brand book stand in for Brand (ADR-0026), newest first.
        const kept = r.data.flatMap((p) => {
          const c = p.content as { kind?: unknown; domain?: unknown; fitness?: unknown; version?: unknown } | null;
          return p.type === "SUBSTITUTION" && p.status !== "DRAFT" && c?.kind === "ASSET_STANDS_IN" && c.domain === "BRAND"
            ? [{ at: p.createdAt, view: { proposalId: p.id, status: p.status, fitness: String(c.fitness ?? ""), version: Number(c.version ?? 0), submittedAt: p.submittedAt, decidedAt: p.decidedAt } }]
            : [];
        }).sort((a, b) => b.at.localeCompare(a.at));
        return ok(kept[0]?.view ?? null);
      },
      decideKeptBrand: async (proposalId, approve) => voidResult(await call("POST", `/v1/proposals/${encodeURIComponent(proposalId)}/decision`, { action: approve ? "APPROVE" : "REJECT" })),
    },

    runs: {
      async list(projectId) {
        const r = await call<Array<{ run: ApiRun; tasks: ApiRunTask[] }>>("GET", `/v1/projects/${projectId}/runs`);
        return r.error || !r.data ? { data: null, error: r.error } : ok(r.data.map(({ run, tasks }): RunView => ({
          id: run.id, project_id: run.projectId, status: run.status, wait_reason: run.waitReason, plan_version: run.planVersion, close_reason: run.closeReason,
          started_at: run.startedAt, ended_at: run.endedAt, tasks: tasks.map(toRunTask),
        })));
      },
      async budget(projectId) {
        const r = await call<{ runId: string | null; runStatus?: RunView["status"]; approvedUsd?: number | null; usedUsd?: number; usedPercent?: number | null }>("GET", `/v1/projects/${projectId}/budget`);
        if (r.error || !r.data) return { data: null, error: r.error };
        const b = r.data;
        return ok(b.runId === null ? null : ({ run_id: b.runId, run_status: b.runStatus!, approved_usd: b.approvedUsd ?? null, used_usd: b.usedUsd ?? 0, used_percent: b.usedPercent ?? null } satisfies BudgetView));
      },
      async pause(projectId, note) { return voidResult(await call("POST", `/v1/projects/${projectId}/pause`, note ? { note } : {})); },
      async resume(projectId) { return voidResult(await call("POST", `/v1/projects/${projectId}/resume`, {})); },
      async cancel(projectId, note) { return voidResult(await call("POST", `/v1/projects/${projectId}/cancel`, note ? { note } : {})); },
    },

    questions: {
      async list(opts) {
        const r = await call<ApiQuestion[]>("GET", `/v1/interventions?status=live${opts?.projectId ? `&projectId=${opts.projectId}` : ""}`);
        return r.error || !r.data ? { data: null, error: r.error } : ok(r.data.map(toQuestion));
      },
      async answer(questionId, answer) {
        const params = { ...(answer.toUsd !== undefined ? { toUsd: answer.toUsd } : {}), ...(answer.evidence ? { evidence: answer.evidence } : {}) };
        return voidResult(await call("POST", `/v1/interventions/${questionId}/resolve`, { option: answer.option, ...(answer.note ? { note: answer.note } : {}), ...(Object.keys(params).length ? { params } : {}) }));
      },
    },

    briefs: {
      async list(opts) {
        const qs = new URLSearchParams({ ...(opts?.projectId ? { projectId: opts.projectId } : {}), ...(opts?.type ? { type: opts.type } : {}), limit: "100" });
        const r = await call<ApiBrief[]>("GET", `/v1/briefs?${qs}`);
        return r.error || !r.data ? { data: null, error: r.error } : ok(r.data.map(toBrief));
      },
      async get(id) {
        const r = await call<ApiBrief & { sentences: Array<{ position: number; section: string; kind: "FACT" | "GAP"; text: string; citations: ApiCitation[] }> }>("GET", `/v1/briefs/${id}`);
        if (r.error || !r.data) return { data: null, error: r.error };
        return ok({
          ...toBrief(r.data),
          statements: r.data.sentences.map((x) => ({
            position: x.position, section: x.section, kind: x.kind, text: x.text,
            sources: x.citations.map((c) => ({ type: c.type, ids: c.ids ?? (c.id ? [c.id] : []), path: c.path ?? null, expect: c.expect ?? c.expectSum ?? null, sum: Boolean(c.ids) })),
          })),
        } satisfies BriefDoc);
      },
      async verify(id) {
        const r = await call<{ ok: boolean; facts: number; gaps: number; problems: Array<{ text: string; problem: string }> }>("GET", `/v1/briefs/${id}/verify`);
        if (r.error || !r.data) return { data: null, error: r.error };
        return ok({ ok: r.data.ok, facts: r.data.facts, gaps: r.data.gaps, problems: r.data.problems.map((p) => `“${p.text}” — ${p.problem}`) });
      },
    },

    settings: {
      async system() {
        const r = await call<{ agencyMode: SystemView["agency_mode"]; readsWith: SystemView["reads_with"]; modelSwitchedOn: boolean; waiting: SystemView["waiting"]; revisionsWaiting: number }>("GET", "/v1/settings/system");
        if (r.error || !r.data) return { data: null, error: r.error };
        const v = r.data;
        return ok({ agency_mode: v.agencyMode, reads_with: v.readsWith, model_switched_on: v.modelSwitchedOn, waiting: v.waiting, revisions_waiting: v.revisionsWaiting });
      },
      async fees() {
        const r = await call<{ policies: Array<{ scope: string; agencyFeePct: number; updatedAt: string }>; rates: Array<{ capability: string; rigor: Rigor; unitUsd: number; updatedAt: string }> }>("GET", "/v1/fees");
        if (r.error || !r.data) return { data: null, error: r.error };
        const v: FeesView = {
          policies: r.data.policies.map((p) => ({ scope: toFeeScope(p.scope), agency_fee_pct: p.agencyFeePct, updated_at: p.updatedAt })),
          rates: r.data.rates.map((x) => ({ capability: x.capability, rigor: x.rigor, unit_usd: x.unitUsd, updated_at: x.updatedAt })),
        };
        return ok(v);
      },
      async setFeePolicy({ agencyFeePct, scope }) {
        const where = scope.kind === "organization" ? { organizationId: scope.id } : scope.kind === "project" ? { projectId: scope.id } : {};
        return voidResult(await call("PUT", "/v1/fees/policy", { agencyFeePct, ...where }));
      },
      async clearFeePolicy(scope) {
        return voidResult(await call("DELETE", `/v1/fees/policy?${scopeParams(scope)}`));
      },
      async setRate(input) {
        return voidResult(await call("PUT", "/v1/fees/rates", input));
      },
      async removeRate({ capability, rigor }) {
        return voidResult(await call("DELETE", `/v1/fees/rates?capability=${encodeURIComponent(capability)}&rigor=${rigor}`));
      },
      async spend() {
        const r = await call<{ monthlyCeilingUsd: number; perCallCeilingUsd: number; spentUsd: number; reservedUsd: number; remainingUsd: number; calls: number; refused: number; enforced: boolean }>("GET", "/v1/spend");
        if (r.error || !r.data) return { data: null, error: r.error };
        const v = r.data;
        const out: SpendView = { monthly_ceiling_usd: v.monthlyCeilingUsd, per_call_ceiling_usd: v.perCallCeilingUsd, spent_usd: v.spentUsd, reserved_usd: v.reservedUsd, remaining_usd: v.remainingUsd, calls: v.calls, refused: v.refused, enforced: v.enforced };
        return ok(out);
      },
      async setSpendPolicy(input) {
        return voidResult(await call("PUT", "/v1/spend/policy", input));
      },
      async sessions() {
        const r = await call<Array<{ id: string; createdAt: string; lastSeenAt: string; userAgent: string | null; current: boolean }>>("GET", "/v1/auth/sessions");
        if (r.error || !r.data) return { data: null, error: r.error };
        return ok(r.data.map((x): SessionView => ({ id: x.id, created_at: x.createdAt, last_seen_at: x.lastSeenAt, user_agent: x.userAgent, current: x.current })));
      },
      async endSession(id) {
        return voidResult(await call("DELETE", `/v1/auth/sessions/${encodeURIComponent(id)}`));
      },
    },
    notifications: {
      async list() {
        const r = await call<Array<{ id: string; briefId: string; title: string; type: BriefType; projectId: string | null; level: number; status: NotificationItem["status"]; reason: string | null; createdAt: string }>>("GET", "/v1/notifications?limit=50");
        return r.error || !r.data ? { data: null, error: r.error } : ok(r.data.map((n) => ({ id: n.id, brief_id: n.briefId, title: n.title, type: n.type, project_id: n.projectId, level: n.level, status: n.status, reason: n.reason, created_at: n.createdAt })));
      },
      async preferences() {
        const r = await call<ApiPrefs>("GET", "/v1/me/notification-preferences");
        return r.error || !r.data ? { data: null, error: r.error } : ok(toPrefs(r.data));
      },
      async savePreferences(p) {
        const r = await call<ApiPrefs>("PUT", "/v1/me/notification-preferences", { timezone: p.timezone, quietHours: p.quiet_hours, minInterruptLevel: p.min_interrupt_level, emailEnabled: p.email_enabled, digest: p.digest });
        return r.error || !r.data ? { data: null, error: r.error } : ok(toPrefs(r.data));
      },
    },

    actionLinks: {
      async describe(token) {
        const r = await call<{ state: ActionLinkView["state"]; option: ActionLinkView["option"]; label: string; does: string; title: string; summary: string; project: string | null; expiresAt: string }>("GET", `/v1/action-links/${encodeURIComponent(token)}`);
        return r.error || !r.data ? { data: null, error: r.error } : ok({ state: r.data.state, option: r.data.option, label: r.data.label, does: r.data.does, title: r.data.title, summary: r.data.summary, project: r.data.project, expires_at: r.data.expiresAt });
      },
      async confirm(token) {
        const r = await call<{ done: true; option: ActionLinkView["option"] }>("POST", `/v1/action-links/${encodeURIComponent(token)}/confirm`, { confirm: true });
        return r.error || !r.data ? { data: null, error: r.error } : ok({ option: r.data.option });
      },
    },

    audit: {
      async chain(organizationId) {
        const r = await call<{ verdict: { ok: boolean; entries?: number; brokenAt?: number; reason?: string }; entries: Array<{ sequence: number; kind: string; subjectType: string; actorUserId: string; createdAt: string }> }>("GET", `/v1/organizations/${organizationId}/audit`);
        if (r.error || !r.data) return { data: null, error: r.error };
        return ok({
          ok: r.data.verdict.ok, broken_at: r.data.verdict.brokenAt ?? null, reason: r.data.verdict.reason ?? null,
          entries: r.data.entries.map((e) => ({ sequence: e.sequence, kind: e.kind, subject_type: e.subjectType, actor_id: e.actorUserId, created_at: e.createdAt })),
        } satisfies AuditChain);
      },
    },

    standing: {
      async list(organizationId) {
        const r = await call<ApiDelegation[]>("GET", `/v1/organizations/${organizationId}/standing-policies`);
        return r.error || !r.data ? { data: null, error: r.error } : ok(r.data.map(toDelegation));
      },
      async grant(input) {
        const r = await call<ApiDelegation>("POST", `/v1/organizations/${input.organizationId}/standing-policies`, { scopes: input.scopes, validDays: input.validDays });
        return r.error || !r.data ? { data: null, error: r.error } : ok(toDelegation(r.data));
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
        const r = await call<ApiDelegation[]>("GET", `/v1/projects/${projectId}/delegations`);
        return r.error || !r.data ? { data: null, error: r.error } : ok(r.data.map(toDelegation));
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
      async clientView(proposalId) {
        type Range = { lowUsd: number; highUsd: number };
        const range = (x: Range) => ({ low: x.lowUsd, high: x.highUsd });
        const r = await call<{
          id: string; projectId: string; version: number; status: ClientPlanView["status"];
          summary: { objective: string; price: { projectFee: Range; agencyFeePct: number; agencyFee: Range; passThrough: Array<{ item: string } & Range>; total: Range } | null; priceNote: string; milestones: Array<{ name: string; target: string | null }> };
          phases: ClientPlanView["phases"]; needs: ClientPlanView["needs"]; assumed: string[];
          decisions: Array<{ description: string; decidedBy: "YOU" | "YOU_OR_AGENCY" }>; delegation: { inForce: boolean; alwaysYours: string[] };
          more: { included: string[]; notIncluded: string[]; measures: Array<{ target: string; how: string; window: string }>; risks: Array<{ risk: string; mitigation: string }> };
          changes: { since: number; lines: string[] } | null;
        }>("GET", `/v1/proposals/${proposalId}/client-view`);
        if (r.error || !r.data) return { data: null, error: r.error };
        const v = r.data;
        const price = v.summary.price;
        return ok({
          id: v.id, project_id: v.projectId, version: v.version, status: v.status,
          summary: {
            objective: v.summary.objective, price_note: v.summary.priceNote, milestones: v.summary.milestones,
            price: price ? { project_fee: range(price.projectFee), agency_fee_pct: price.agencyFeePct, agency_fee: range(price.agencyFee), pass_through: price.passThrough.map((x) => ({ item: x.item, ...range(x) })), total: range(price.total) } : null,
          },
          phases: v.phases, needs: v.needs, assumed: v.assumed,
          decisions: v.decisions.map((d) => ({ description: d.description, decided_by: d.decidedBy })),
          delegation: { in_force: v.delegation.inForce, always_yours: v.delegation.alwaysYours },
          more: { included: v.more.included, not_included: v.more.notIncluded, measures: v.more.measures, risks: v.more.risks },
          changes: v.changes,
        });
      },
      async allowAgencyToDecide({ organizationId, projectId }) {
        return voidResult(await call("POST", `/v1/organizations/${organizationId}/permissions/grants`, { scope: "STANDING", projectId }));
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
