// Runs inside the v4 checkout (cwd = V4_DIR) so it can use v4's own code. Stands in for the agency's own plan reaching a person's
// step with a guide (v4 ADR-0071): a store set up on a hosted platform by a person on the team (ADR-0070). The plan is approved as a
// decision would approve it, and v4's own engine drives the run to the step, which writes the pack's guide and asks the CEO.
// Usage: tsx guide-seed.mjs <CEO email>. Prints the question and the project.
import { createRequire } from "node:module";
const root = process.cwd();
const { PrismaClient } = createRequire(`${root}/package.json`)("@prisma/client");
const { draftProposal, submitProposal } = await import(`${root}/packages/proposals/src/index.ts`);
const { startRun } = await import(`${root}/packages/runs/src/start.ts`);
const { driveRun, ExecutorRegistry, DemoExecutor } = await import(`${root}/packages/runs/src/index.ts`);

const [ceoEmail] = process.argv.slice(2);
const db = new PrismaClient();
try {
  const ceo = await db.user.findUniqueOrThrow({ where: { email: ceoEmail } });
  const agency = await db.organization.findFirstOrThrow({ where: { kind: "AGENCY" } });
  const project = await db.project.create({ data: { organizationId: agency.id, name: "Candle store setup (e2e)", status: "PROPOSED" } });
  const plan = {
    objective: "Open an online candle store that takes orders in Lagos", scope: { in: ["The store"], out: [] }, deliverables: [{ id: "d1", name: "Store", domain: "ENGINEERING" }],
    successMetrics: [{ id: "m1", metric: "Orders", baseline: null, target: "First order", measurement: "Store admin", window: "30 days", dataSource: "Store" }],
    tasks: [{ id: "setup", title: "Set up the store on Bumpa", domain: "ENGINEERING", capability: "hosted-store-setup", executor: "HUMAN", rigor: "standard", risk: 2, reversibility: 4, dependsOn: [] }],
    budget: { currency: "USD", lowUsd: 0, highUsd: 5, confidence: 0.5 }, risks: [], assumptions: [],
  };
  const draft = await draftProposal(db, { projectId: project.id, type: "PLAN", content: plan, impact: 3, reversibility: 4, authority: { approvalLevel: "L1" }, proposedBy: "planner:e2e" });
  await submitProposal(db, draft.id);
  const approved = await db.proposal.update({ where: { id: draft.id }, data: { status: "APPROVED", decision: "APPROVED", decidedAt: new Date(), decidedById: ceo.id } });
  const run = await db.$transaction((tx) => startRun(tx, { proposal: approved, plan, startedById: ceo.id }));
  await driveRun(db, new ExecutorRegistry([new DemoExecutor()]), run.id);
  const q = await db.intervention.findFirstOrThrow({ where: { runId: run.id, reason: "HUMAN_TASK" } });
  console.log(JSON.stringify({ id: q.id, title: q.title, projectId: project.id, projectName: project.name }));
} finally {
  await db.$disconnect();
}
