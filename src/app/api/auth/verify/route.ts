import { callApi, clientIp, json, sameOrigin, sessionCookie, sessionFor } from "@/lib/server/v4";

/**
 * Finish signing in with the emailed link (token) or the six-digit code. The API returns the session secret once; it goes
 * straight into an httpOnly cookie and is never sent on to the browser.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "FORBIDDEN" }, 403);
  const res = await callApi("/v1/auth/sign-in/verify", { method: "POST", body: await req.text(), headers: { "content-type": "application/json" }, ip: clientIp(req) });
  const body = (await res.json().catch(() => ({}))) as { sessionSecret?: string; error?: string };
  if (!res.ok || !body.sessionSecret) return json({ error: body.error ?? "INVALID_OR_EXPIRED" }, res.status === 200 ? 400 : res.status);
  return json({ session: await sessionFor(body.sessionSecret) }, 200, { "set-cookie": sessionCookie(body.sessionSecret) });
}
