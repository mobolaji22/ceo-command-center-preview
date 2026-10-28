/**
 * Server-side only: how this app talks to the dev-playbook-v4 API on the browser's behalf.
 *
 * The session secret lives in an httpOnly cookie that only these route handlers read. It is never placed in a response
 * body, never exposed to scripts, and never sent to the browser in any other form.
 */
export const COOKIE = "dpb_session";
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60; // the API's absolute session limit; the API is what actually ends a session

export const apiBase = () => (process.env["V4_API_URL"] ?? "http://localhost:4000").replace(/\/$/, "");

export function sessionCookie(secret: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure}`;
}
export const clearedCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function secretFrom(req: Request): string | null {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/**
 * Cross-site request forgery: a state-changing request must come from this app's own pages. The cookie is SameSite=Lax,
 * and on top of that the Origin header must match.
 */
export function sameOrigin(req: Request): boolean {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const expected = process.env["APP_ORIGIN"] ?? new URL(req.url).origin;
  return origin === expected;
}

/** The caller's address for the API's per-address rate limits; the API only trusts it when it is told it sits behind a proxy. */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
}

export async function callApi(path: string, init: { method?: string; secret?: string | null; body?: BodyInit | null; headers?: Record<string, string>; ip?: string } = {}) {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  if (init.secret) headers["authorization"] = `Bearer ${init.secret}`;
  if (init.ip) headers["x-forwarded-for"] = init.ip;
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      method: init.method ?? "GET",
      headers,
      ...(init.body !== undefined && init.body !== null ? { body: init.body, duplex: "half" as const } : {}),
      redirect: "manual",
      cache: "no-store",
    } as RequestInit);
    if (response.status >= 500) return json({ error: "SERVICE_UNAVAILABLE" }, 503);
    return response;
  } catch {
    return json({ error: "SERVICE_UNAVAILABLE" }, 503);
  }
}

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...extra } });

export type MeResponse = { userId: string; email: string; name: string | null; isCEO: boolean; isAgency: boolean; memberships: Array<{ organizationId: string; role: string }> };

/** The signed-in person, in the shape the UI uses. Null when there is no valid session. */
export async function sessionFor(secret: string | null) {
  if (!secret) return null;
  const res = await callApi("/v1/me", { secret });
  if (!res.ok) return null;
  const me = (await res.json()) as MeResponse;
  return {
    userId: me.userId,
    email: me.email,
    displayName: me.name ?? me.email.split("@")[0] ?? me.email,
    role: me.isAgency ? ("owner" as const) : ("client" as const),
    memberships: me.memberships.filter((m) => m.role === "CLIENT_OWNER" || m.role === "CLIENT_MEMBER").map((m) => ({ organizationId: m.organizationId, role: m.role })),
  };
}
