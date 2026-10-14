import { apiBase, clearedCookie, json, sameOrigin, secretFrom } from "@/lib/server/v4";

export const dynamic = "force-dynamic";

/**
 * The only way the browser reaches the v4 API. It adds the session from the httpOnly cookie, forwards the request and
 * streams the answer back. Rules:
 *  - only `/v1/...` paths;
 *  - the calls that mint a session (`sign-in/verify`, `invitations/accept`) are refused here, because their answer carries
 *    the session secret; they have their own routes that put it in the cookie instead;
 *  - a state-changing request must come from this app's own origin;
 *  - the browser's own Authorization and Cookie headers are never forwarded.
 */
const MINTS_A_SESSION = new Set(["v1/auth/sign-in/verify", "v1/invitations/accept"]);
// `etag` and the request's `if-none-match` pass through so a read the API marks unchanged (`/v1/domains`) can answer 304.
const PASS_RESPONSE = ["content-type", "content-disposition", "content-length", "cache-control", "etag", "x-content-type-options", "content-security-policy"];

async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = path.join("/");
  if (path[0] !== "v1" || path.some((p) => p === ".." || p === "." || p === "")) return json({ error: "NOT_FOUND" }, 404);
  if (MINTS_A_SESSION.has(target)) return json({ error: "NOT_FOUND" }, 404);
  if (!sameOrigin(req)) return json({ error: "FORBIDDEN" }, 403);

  const secret = secretFrom(req);
  const headers: Record<string, string> = {};
  const type = req.headers.get("content-type");
  if (type) headers["content-type"] = type;
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch) headers["if-none-match"] = ifNoneMatch;
  if (secret) headers["authorization"] = `Bearer ${secret}`;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) headers["x-forwarded-for"] = ip;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBase()}/${target}${new URL(req.url).search}`, {
      method: req.method, headers, redirect: "manual", cache: "no-store",
      ...(hasBody ? { body: await req.arrayBuffer() } : {}),
    });
  } catch {
    return json({ error: "UPSTREAM_UNAVAILABLE" }, 502);
  }
  const out = new Headers();
  for (const h of PASS_RESPONSE) { const v = upstream.headers.get(h); if (v) out.set(h, v); }
  // A session the API no longer honours should not linger in the browser.
  if (upstream.status === 401 && secret) out.append("set-cookie", clearedCookie());
  return new Response(upstream.status === 204 || upstream.status === 304 ? null : upstream.body, { status: upstream.status, headers: out });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
