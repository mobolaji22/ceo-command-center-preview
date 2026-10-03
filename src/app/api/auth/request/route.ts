import { callApi, clientIp, json, sameOrigin } from "@/lib/server/v4";

/** Ask for a sign-in link and code. The API answers the same whether or not the address has an account. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "FORBIDDEN" }, 403);
  const res = await callApi("/v1/auth/sign-in/request", { method: "POST", body: await req.text(), headers: { "content-type": "application/json" }, ip: clientIp(req) });
  return json(await res.json().catch(() => ({})), res.status);
}
