import { execFileSync } from "node:child_process";

const ADMIN = process.env["E2E_PG_ADMIN"] ?? "postgresql://lovable@localhost:5432/postgres?host=/tmp";

/**
 * Sign-in is rate limited per person (five links an hour), as it should be, and a test run asks for more than that. The
 * scratch database forgets earlier requests between tests; the limit itself is exercised by the v4 repo's own tests.
 */
export function forgetSignInRequests() {
  const u = new URL(ADMIN);
  u.pathname = "/cc_e2e";
  execFileSync("psql", [u.toString(), "-v", "ON_ERROR_STOP=1", "-c", 'DELETE FROM "LoginToken"'], { stdio: "pipe" });
}
