import { callApi, clearedCookie, json, sameOrigin, secretFrom } from "@/lib/server/v4";

/** Ends the session at the API (so the secret is dead everywhere) and clears the cookie, whatever the API says. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "FORBIDDEN" }, 403);
  const secret = secretFrom(req);
  if (secret) await callApi("/v1/auth/sign-out", { method: "POST", secret }).catch(() => undefined);
  return new Response(null, { status: 204, headers: { "set-cookie": clearedCookie() } });
}
