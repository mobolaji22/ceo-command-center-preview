// Runs inside the v4 checkout (cwd = V4_DIR) so it can use v4's own code. Stands in for the worker's engine reaching the budget: drives
// the project's live run once with an executor that reports the budget is reached, which stops it with a question for the client's owner.
// Usage: tsx stop-run.mjs <project name fragment>
import { createRequire } from "node:module";
const root = process.cwd();
const { PrismaClient } = createRequire(`${root}/package.json`)("@prisma/client");
const { driveRun, ExecutorRegistry, ExecutorError } = await import(`${root}/packages/runs/src/index.ts`);
const { NO_ACCESS_POLICY } = await import(`${root}/packages/executors/src/index.ts`);

const [fragment] = process.argv.slice(2);
const db = new PrismaClient();
try {
  const project = await db.project.findFirstOrThrow({ where: { name: { contains: fragment, mode: "insensitive" } } });
  const run = await db.run.findFirstOrThrow({ where: { projectId: project.id, status: "RUNNING" }, orderBy: { startedAt: "desc" } });
  const reached = new ExecutorRegistry(["MODEL", "BROWSER", "RESEARCH", "SANDBOX"].map((kind) => ({
    id: `e2e-${kind}`, kinds: [kind], policy: NO_ACCESS_POLICY, estimateUsd: () => 0, run: async () => { throw new ExecutorError("BUDGET", "The budget has been reached"); },
  })));
  await driveRun(db, reached, run.id);
  const q = await db.intervention.findFirstOrThrow({ where: { runId: run.id, status: "OPEN" } });
  console.log(JSON.stringify({ reason: q.reason, id: q.id }));
} finally { await db.$disconnect(); }
