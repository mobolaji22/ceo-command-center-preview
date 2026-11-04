// Runs inside the v4 checkout (cwd = V4_DIR) so it can use v4's own code. Stands in for the worker driving a Design project's run
// with a model: the model is a script (the roastery's meaning model and v4's territory-exploration golden seed; fixtures for the
// rest), and everything after it is v4's own (the gateway, the engine, the draft it writes). Drives the project's live run until it
// stops, and prints the question it stopped on.
// Usage: tsx design-run.mjs <CEO email>. The run is the newest live one with a territory-exploration step.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const root = process.cwd();
const { PrismaClient } = createRequire(`${root}/package.json`)("@prisma/client");
const { driveRun, ExecutorRegistry, DemoExecutor, ModelExecutor } = await import(`${root}/packages/runs/src/index.ts`);
const { ModelGateway } = await import(`${root}/packages/models/src/gateway.ts`);
const { loadRoleTable } = await import(`${root}/packages/models/src/roles.ts`);
const { FixtureProvider } = await import(`${root}/packages/models/src/fixture-provider.ts`);
const { packRegistry } = await import(`${root}/packages/packs/src/index.ts`);
const { PrismaSpendGate, setSpendPolicy, usdToMicros } = await import(`${root}/packages/state/src/spend.ts`);

const [ceoEmail] = process.argv.slice(2);
const db = new PrismaClient();
try {
  const step = await db.task.findFirstOrThrow({ where: { capability: "territory-exploration", run: { status: "RUNNING" } }, orderBy: { createdAt: "desc" } });
  const run = await db.run.findUniqueOrThrow({ where: { id: step.runId } });
  const project = await db.project.findUniqueOrThrow({ where: { id: run.projectId } });
  // A model call needs a budget from the CEO first ("no envelope, no paid-model spend"); the script's calls cost nothing real.
  const ceo = await db.user.findUniqueOrThrow({ where: { email: ceoEmail } });
  await setSpendPolicy(db, { monthlyCeilingMicros: usdToMicros(10), perCallCeilingMicros: usdToMicros(1), setById: ceo.id });
  const meaning = {
    business_goal: "Grow monthly subscriptions from first-time visitors", user_goal: "Trust the roast enough to subscribe", audience: "Home brewers",
    context: "First visit from search", primary_message: "Roasted weekly in small batches, so it arrives fresh", supporting_messages: ["The roast date is on every bag"],
    desired_belief: "These roasters are careful", desired_emotion: "Reassured", desired_action: "Start a subscription", desired_memory: "The roast date",
    differentiation: "The roast date is on every bag and on the page", trust_requirements: ["See when the coffee was roasted"], open_items: [],
  };
  const territories = JSON.parse(readFileSync(`${root}/tests/fixtures/golden-seeds/territory-exploration-orbit.json`, "utf8"));
  const scripted = (model) => ({
    id: "openrouter", name: "openrouter", model, qualityHint: 1,
    capabilities: { text: true, structured: true, vision: false, embeddings: false, toolUse: false },
    generate: async () => { throw new Error("not used"); }, vision: async () => { throw new Error("not used"); }, embed: async () => [],
    estimateCost: async () => 0.001,
    structured: async (request) => {
      const output = request.capability === "meaning-model" ? meaning : request.capability === "territory-exploration" ? territories
        : (await new FixtureProvider().structured(request)).output;
      return { output, cost: 0.002, inputTokens: 10, outputTokens: 10, latencyMs: 1, model, provider: "openrouter" };
    },
  });
  const gateway = new ModelGateway({ table: loadRoleTable(), gate: new PrismaSpendGate(db), env: { OPENROUTER_API_KEY: "e2e" }, build: (route) => scripted(route.model) });
  await driveRun(db, new ExecutorRegistry([new DemoExecutor(), new ModelExecutor(db, gateway, packRegistry())]), run.id);
  const q = await db.intervention.findFirstOrThrow({ where: { runId: run.id, status: "OPEN" } });
  console.log(JSON.stringify({ id: q.id, summary: q.summary, projectId: project.id, projectName: project.name }));
} finally { await db.$disconnect(); }
