// Runs inside the v4 checkout (cwd = V4_DIR) so it can use v4's own code. Stands in for what the worker does when it emails a
// brief about a stopped project: writes the Exception brief for the question, then asks v4 for the action links that email carries.
// Usage: node/tsx make-action-link.mjs <project name fragment> <owner email>. Prints the links as JSON.
import { createRequire } from "node:module";
const root = process.cwd();
const { PrismaClient } = createRequire(`${root}/package.json`)("@prisma/client");
const { saveBrief, BriefBuilder } = await import(`${root}/packages/briefs/src/index.ts`);
const { issueActionLinks } = await import(`${root}/packages/notifications/src/index.ts`);

const [fragment, ownerEmail] = process.argv.slice(2);
const db = new PrismaClient();
try {
  const project = await db.project.findFirstOrThrow({ where: { name: { contains: fragment, mode: "insensitive" } } });
  const q = await db.intervention.findFirstOrThrow({ where: { projectId: project.id, status: { in: ["OPEN", "REMINDED", "ESCALATED"] } }, orderBy: { createdAt: "desc" } });
  await db.$transaction((tx) => saveBrief(tx, { organizationId: q.organizationId, projectId: q.projectId, type: "EXCEPTION", audience: "CLIENT", title: q.title, subjectType: "INTERVENTION", subjectId: q.id, attentionLevel: 4 }, new BriefBuilder().gap("What", "Something")));
  const brief = await db.brief.findFirstOrThrow({ where: { type: "EXCEPTION", subjectId: q.id } });
  const n = await db.notification.findFirstOrThrow({ where: { briefId: brief.id, user: { email: ownerEmail } } });
  console.log(JSON.stringify(await issueActionLinks(db, n, brief, process.env.APP_URL)));
} finally { await db.$disconnect(); }
