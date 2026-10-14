# Agent notes — CEO Command Center (Next.js)

This is the front end of **dev-playbook-v4**. Build authority: `docs/V4-MASTER-PLAN.md` §5.5 in the
dev-playbook-v4 repo. Read `docs/INTEGRATION.md` here first.

Rules:

- Next.js App Router, React 19, Tailwind 4, shadcn/Radix. No backend, database client or vendor SDK
  (no Supabase) lives in this repo. Identity, data and authority belong to the v4 API.
- The `DataSource` interface (`src/lib/data/types.ts`) is the only door to data. Components call
  `useDataSource()`; they never `fetch` directly. New capability means: extend the interface, then
  implement it in both `fixtures.ts` and `api.ts`.
- Identity is never sent by the browser. The session is an httpOnly cookie set by this app's own server (`src/app/api`, the BFF); the browser never calls v4 directly and never sees the session secret. There are no passwords: sign-in is an emailed link or code.
- Fixtures are demo-only and blocked in production unless `NEXT_PUBLIC_ALLOW_FIXTURES=true`.
- `src/components/ui/*` are direct copies of the preview's shadcn files; do not restyle them.
- Visual system lives in `src/app/globals.css` (preview, unchanged but for `@source`) and
  `src/app/screens.css` (completions for screens the preview never styled).
- Checks before commit: `npm run typecheck && npm run lint && npm run build`; `npm run test:e2e` when auth, the proxy or the asset flow changed.
- Do not force-push or rewrite published history.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
