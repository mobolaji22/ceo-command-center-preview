import { clearedCookie, json, secretFrom, sessionFor } from "@/lib/server/v4";

export const dynamic = "force-dynamic";

/** Who is signed in, resolved by the API from the cookie. A cookie the API no longer accepts is cleared. */
export async function GET(req: Request) {
  const secret = secretFrom(req);
  const session = await sessionFor(secret);
  return json({ session }, 200, secret && !session ? { "set-cookie": clearedCookie() } : {});
}
