import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Boots the real thing for the browser tests:
 *   - a scratch Postgres database, migrated, with the restricted API role and a bootstrapped CEO;
 *   - the dev-playbook-v4 API (console email transport, so the test can read the "emailed" links);
 *   - this app, built against that API and started.
 *
 * Needs: a dev-playbook-v4 checkout (V4_DIR, default ../dev-playbook-v4) with its dependencies installed, Postgres
 * (E2E_PG_ADMIN, a superuser URL), and Redis on REDIS_URL. Set E2E_SKIP_BUILD=1 to reuse an existing build.
 */
const V4_DIR = resolve(process.env["V4_DIR"] ?? "../dev-playbook-v4");
const ADMIN = process.env["E2E_PG_ADMIN"] ?? "postgresql://lovable@localhost:5432/postgres?host=/tmp";
export const DB = "cc_e2e";
export const CEO_EMAIL = "ceo@agency.example";

const withDb = (user?: string) => {
  const u = new URL(ADMIN);
  u.pathname = `/${DB}`;
  if (user) { u.username = user; u.password = ""; }
  return u.toString();
};

const children: ChildProcess[] = [];

async function waitFor(url: string, what: string) {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${what} did not come up at ${url}`);
}

export default async function globalSetup() {
  // The design document's types are v4's (ADR-0049): fail first if the copy here has drifted from the v4 under test.
  execFileSync("node", ["scripts/sdd-types.mjs", "--check"], { env: { ...process.env, V4_DIR }, stdio: "pipe" });
  const work = mkdtempSync(join(tmpdir(), "cc-e2e-"));
  const outbox = join(work, "outbox");
  process.env["E2E_OUTBOX"] = join(outbox, "emails.jsonl");

  const psql = (sql: string) => execFileSync("psql", [ADMIN, "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
  psql(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
  psql(`CREATE DATABASE ${DB}`);

  const v4Env = { ...process.env, DATABASE_URL: withDb(), DATABASE_APP_URL: withDb("dpb_app") };
  const run = (args: string[]) => execFileSync("npx", args, { cwd: V4_DIR, env: v4Env, stdio: "pipe" });
  run(["prisma", "migrate", "deploy"]);
  run(["tsx", "scripts/db-roles.ts"]);
  run(["tsx", "scripts/bootstrap-ceo.ts", "--email", CEO_EMAIL, "--agency", "Agency", "--name", "Ola"]);

  const api = spawn("npx", ["tsx", "apps/api/src/server.ts"], {
    cwd: V4_DIR, stdio: "ignore", detached: true,
    env: {
      ...v4Env, PORT: "4100", NODE_ENV: "development", AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0000", APP_URL: "http://localhost:3100",
      EMAIL_TRANSPORT: "console", DEV_OUTBOX_DIR: outbox, STORAGE_DIR: join(work, "files"), API_PUBLIC_URL: "http://localhost:4100",
      TRUST_PROXY: "true", REDIS_URL: process.env["REDIS_URL"] ?? "redis://localhost:6379",
    },
  });
  children.push(api);
  await waitFor("http://localhost:4100/health", "the v4 API");

  const appEnv = { ...process.env, NEXT_PUBLIC_DATA_SOURCE: "api", V4_API_URL: "http://localhost:4100", APP_ORIGIN: "http://localhost:3100" };
  if (!process.env["E2E_SKIP_BUILD"]) execFileSync("npx", ["next", "build"], { env: appEnv, stdio: "pipe" });
  children.push(spawn("npx", ["next", "start", "-p", "3100"], { env: appEnv, stdio: "ignore", detached: true }));
  await waitFor("http://localhost:3100/auth", "the Command Center");

  return async () => {
    // Each server runs in its own process group (npx starts a child), so stop the whole group.
    for (const c of children) { try { process.kill(-c.pid!, "SIGTERM"); } catch { /* already gone */ } }
    rmSync(work, { recursive: true, force: true });
  };
}
