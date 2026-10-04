import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

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

/**
 * Stands in for the engine having done some paid work: a settled cost record against the project's newest run. (Nothing in the
 * end-to-end environment runs the worker, so the budget meter would otherwise always read zero.)
 */
export function recordSpend(projectNamePattern: string, usd: number) {
  const u = new URL(ADMIN);
  u.pathname = "/cc_e2e";
  const micros = Math.round(usd * 1_000_000);
  const sql = `INSERT INTO "CostRecord" (id, "organizationId", "projectId", "runId", "taskId", executor, status, "reservedMicros", "actualMicros", "settledAt")
    SELECT gen_random_uuid()::text, r."organizationId", r."projectId", r.id, (SELECT t.id FROM "Task" t WHERE t."runId" = r.id LIMIT 1), 'e2e', 'SETTLED', ${micros}, ${micros}, now()
    FROM "Run" r JOIN "Project" p ON p.id = r."projectId" WHERE p.name ILIKE '${projectNamePattern}' ORDER BY r."startedAt" DESC LIMIT 1`;
  execFileSync("psql", [u.toString(), "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
}

const V4_DIR = resolve(process.env["V4_DIR"] ?? "../dev-playbook-v4");

/** The id of a brief written to a client, for a test that follows a link in an email to it. */
export function aClientBriefId(): string {
  const u = new URL(ADMIN);
  u.pathname = "/cc_e2e";
  return execFileSync("psql", [u.toString(), "-t", "-A", "-c", `SELECT id FROM "Brief" WHERE audience = 'CLIENT' AND type = 'KICKOFF' ORDER BY "compiledAt" LIMIT 1`], { encoding: "utf8" }).trim();
}

/**
 * Stands in for the worker emailing a brief about a stopped project: has v4 write the Exception brief for the project's open question
 * and issue the action links that email would carry, with the real signing secret. Returns each link's answer and the token in it.
 */
export function actionLinksFor(projectNameFragment: string, ownerEmail: string): Array<{ option: string; token: string }> {
  const u = new URL(ADMIN);
  u.pathname = "/cc_e2e";
  const out = execFileSync("npx", ["tsx", resolve("e2e/make-action-link.mjs"), projectNameFragment, ownerEmail], {
    cwd: V4_DIR, encoding: "utf8",
    env: { ...process.env, DATABASE_URL: u.toString(), AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0000", APP_URL: "http://localhost:3100" },
  });
  const links = JSON.parse(out.trim().split("\n").at(-1)!) as Array<{ option: string; url: string }>;
  return links.map((l) => ({ option: l.option, token: l.url.split("/act/")[1]! }));
}

/**
 * Stands in for the worker's engine reaching a project's approved budget: has v4 drive the project's live run once with an executor that
 * reports the budget is reached, which stops it with a question for the client's owner.
 */
export function stopRunAtBudget(projectNameFragment: string): { reason: string; id: string } {
  const u = new URL(ADMIN);
  u.pathname = "/cc_e2e";
  const out = execFileSync("npx", ["tsx", resolve("e2e/stop-run.mjs"), projectNameFragment], {
    cwd: V4_DIR, encoding: "utf8",
    env: { ...process.env, DATABASE_URL: u.toString(), AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0000" },
  });
  return JSON.parse(out.trim().split("\n").at(-1)!) as { reason: string; id: string };
}
