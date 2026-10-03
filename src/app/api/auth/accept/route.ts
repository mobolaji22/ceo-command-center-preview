import { callApi, clientIp, json, sameOrigin, sessionCookie, sessionFor } from "@/lib/server/v4";

/** Accept an emailed invitation: it creates the person's access and signs them in, once. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "FORBIDDEN" }, 403);
  const res = await callApi("/v1/invitations/accept", { method: "POST", body: await req.text(), headers: { "content-type": "application/json" }, ip: clientIp(req) });
  const body = (await res.json().catch(() => ({}))) as { sessionSecret?: string; error?: string };
  if (!res.ok || !body.sessionSecret) return json({ error: body.error ?? "INVALID_OR_EXPIRED" }, res.status === 200 ? 400 : res.status);
  return json({ session: await sessionFor(body.sessionSecret) }, 200, { "set-cookie": sessionCookie(body.sessionSecret) });
}
