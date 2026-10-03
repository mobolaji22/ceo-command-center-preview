import type { ClientData, OwnerData, Project, Session } from "../model";
import { fail, ok, type DataSource, type Result } from "./types";

/**
 * API DataSource: talks to the dev-playbook-v4 API.
 *
 * Contract-first: these endpoints are the console/portal surface the v4 API will provide
 * (dev-playbook-v4 docs/V4-MASTER-PLAN.md §5.5, increments CC-1..CC-8). Until each endpoint
 * exists, the call fails with a clear error instead of pretending. docs/INTEGRATION.md lists
 * every endpoint and the phase that delivers it.
 *
 * Identity is owned by v4. The browser never holds a token: a Next.js route handler (BFF,
 * built in v4 phase P1) keeps the session in an httpOnly cookie and forwards requests. Until
 * then, requests go straight to NEXT_PUBLIC_V4_API_URL with cookies included.
 */

const BASE = (process.env["NEXT_PUBLIC_V4_API_URL"] ?? "").replace(/\/$/, "");

async function call<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
  let res: Response;
  try {
    const init: RequestInit = {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        // Every command is idempotent on retry; the API de-duplicates on this key.
        ...(method !== "GET" ? { "Idempotency-Key": crypto.randomUUID() } : {}),
      },
    };
    if (body !== undefined) init.body = body instanceof FormData ? body : JSON.stringify(body);
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    return fail(`Could not reach the v4 API at ${BASE || "(NEXT_PUBLIC_V4_API_URL is not set)"}.`);
  }
  if (res.status === 204) return ok(undefined as T);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const message = (json as { error?: { message?: string } | string } | null)?.error;
    return fail(typeof message === "string" ? message : message?.message ?? `Request failed (${res.status}).`);
  }
  return ok(json as T);
}

const must = <T>(r: Result<T>): T => {
  if (r.error || r.data === null) throw new Error(r.error?.message ?? "Empty response.");
  return r.data;
};

const voidResult = (r: Result<unknown>): Result => (r.error ? fail(r.error.message) : ok(undefined as void));

export function createApiDataSource(): DataSource {
  return {
    kind: "api",
    capabilities: {},

    auth: {
      async getSession() {
        const r = await call<Session>("GET", "/v1/auth/session");
        return r.error ? null : r.data;
      },
      signInWithPassword: (email, password) => call<Session>("POST", "/v1/auth/sign-in", { email, password }),
      async requestPasswordReset(email, redirectTo) {
        return voidResult(await call("POST", "/v1/auth/password-reset", { email, redirectTo }));
      },
      async hasRecoverySession() {
        const r = await call<{ recovery: boolean }>("GET", "/v1/auth/recovery");
        return !r.error && r.data?.recovery === true;
      },
      setPassword: (password) => call<Session>("POST", "/v1/auth/password", { password }),
      async signOut() {
        await call("POST", "/v1/auth/sign-out");
      },
      subscribe(onChange) {
        // Cross-tab sign-out: the BFF broadcasts on this channel when the session ends.
        const ch = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("dpl-session") : null;
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
        return voidResult(await call("POST", `/v1/interventions/${id}/resolve`, { approved }));
      },
      async setApprovalConstraints(id, text) {
        return voidResult(await call("PATCH", `/v1/interventions/${id}`, { constraints: text }));
      },
      async requestApprovalEvidence(id, text) {
        return voidResult(await call("PATCH", `/v1/interventions/${id}`, { evidenceRequest: text }));
      },
      async clientResolveApproval(id, approved, note) {
        return voidResult(await call("POST", `/v1/interventions/${id}/resolve`, { approved, note }));
      },

      async issueDirective(input) {
        return voidResult(await call("POST", "/v1/intents", { source: "CEO_DIRECTIVE", ...input }));
      },

      async markSeen() {
        const r = await call<{ since: string | null }>("POST", "/v1/console/seen");
        return r.data?.since ?? null;
      },

      async createOrganization(input) {
        return voidResult(await call("POST", "/v1/organizations", input));
      },
      inviteClient: (input) => call<{ invited: boolean }>("POST", "/v1/invitations", input),
      async unlinkClient(projectId, userId) {
        return voidResult(await call("DELETE", `/v1/projects/${projectId}/members/${userId}`));
      },

      async addDeliverable(projectId, input) {
        const form = new FormData();
        form.set("name", input.name);
        if (input.description) form.set("description", input.description);
        form.set("share", String(input.share));
        if (input.file) form.set("file", input.file);
        return voidResult(await call("POST", `/v1/projects/${projectId}/deliverables`, form));
      },
      async postUpdate(projectId, input) {
        return voidResult(await call("POST", `/v1/projects/${projectId}/updates`, input));
      },
    },
  };
}
