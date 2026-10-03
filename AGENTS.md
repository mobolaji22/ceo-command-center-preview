# Agent notes — CEO Command Center (Next.js)

This is the front end of **dev-playbook-v4**. Build authority: `docs/V4-MASTER-PLAN.md` §5.5 in the
dev-playbook-v4 repo. Read `docs/INTEGRATION.md` here first.

Rules:

- Next.js App Router, React 19, Tailwind 4, shadcn/Radix. No backend, database client or vendor SDK
  (no Supabase) lives in this repo. Identity, data and authority belong to the v4 API.
- The `DataSource` interface (`src/lib/data/types.ts`) is the only door to data. Components call
  `useDataSource()`; they never `fetch` directly. New capability means: extend the interface, then
  implement it in both `fixtures.ts` and `api.ts`.
- Identity is never sent by the browser. The session is an httpOnly cookie owned by v4.
- Fixtures are demo-only and blocked in production unless `NEXT_PUBLIC_ALLOW_FIXTURES=true`.
- `src/components/ui/*` are direct copies of the preview's shadcn files; do not restyle them.
- Visual system lives in `src/app/globals.css` (preview, unchanged but for `@source`) and
  `src/app/screens.css` (completions for screens the preview never styled).
- Checks before commit: `npm run typecheck && npm run lint && npm run build`.
- Do not force-push or rewrite published history.
