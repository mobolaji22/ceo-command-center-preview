// Runs inside the v4 checkout (cwd = V4_DIR) so it can use v4's own code. Stands in for the worker's Media sweep (v4 ADR-0081
// Decision 13): carries out every render the studio queued, with v4's renderer in Chromium and FFmpeg, keeps each file in the API's
// storage (STORAGE_DIR), and has Design's fidelity check read it. Prints the renders it carried out.
// Usage: tsx media-render.mjs
import { createRequire } from "node:module";
const root = process.cwd();
const { PrismaClient } = createRequire(`${root}/package.json`)("@prisma/client");
const { runNextStudioRender } = await import(`${root}/packages/media/src/render-job.ts`);
const { objectStorageFromEnv } = await import(`${root}/packages/assets/src/storage-config.ts`);

const db = new PrismaClient();
try {
  const storage = objectStorageFromEnv(process.env, { secret: "e2e", port: "4100" });
  const done = [];
  for (let id = await runNextStudioRender({ db, storage }); id; id = await runNextStudioRender({ db, storage })) done.push(id);
  const renders = await db.mediaRender.findMany({ where: { id: { in: done } }, select: { id: true, status: true, problems: true } });
  console.log(JSON.stringify(renders));
} finally { await db.$disconnect(); }
