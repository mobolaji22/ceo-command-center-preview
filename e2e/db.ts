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

/**
 * Stands in for the client's owner switching on "decide for me" (the Command Center has no screen for it yet; the API's own
 * tests cover the grant with its step-up). Written straight into the scratch database as a standing permission to the CEO.
 */
export function allowCeoToDecideFor(organizationName: string, ceoEmail: string, ownerEmail: string) {
  const u = new URL(ADMIN);
  u.pathname = "/cc_e2e";
  const sql = `INSERT INTO "Permission" (id, "organizationId", kind, status, scope, "granteeUserId", "grantedById", terms, "decidedAt")
    SELECT gen_random_uuid()::text, o.id, 'DECIDE_ON_BEHALF', 'ACTIVE', 'STANDING', c.id, w.id, 'e2e', now()
    FROM "Organization" o, "User" c, "User" w WHERE o.name = '${organizationName}' AND c.email = '${ceoEmail}' AND w.email = '${ownerEmail}'`;
  execFileSync("psql", [u.toString(), "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
}
