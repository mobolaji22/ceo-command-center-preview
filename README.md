# CEO Command Center

The front end of **dev-playbook-v4**: the CEO's office (command center) and the client portal.
Next.js (App Router) · React 19 · Tailwind 4 · shadcn/Radix · TanStack Query.

This is a direct port of the Lovable `command-center-preview` UI: components, styles and images are
copied; Supabase and the server layer are not. All data flows through one `DataSource` interface.

## Run

```bash
npm install
cp .env.example .env.local      # NEXT_PUBLIC_DATA_SOURCE=fixtures by default
npm run dev
```

Demo sign-ins (fixtures mode, code `123456`): `ceo@example.com`,
`amara@northwind.example`, `tunde@lumen.example`. There are no passwords; real sign-in is an emailed link or code.

## Modes

- `fixtures`: in-browser demo data (persisted in localStorage). Blocked in production builds unless
  `NEXT_PUBLIC_ALLOW_FIXTURES=true`.
- `api`: talks to the v4 API at `V4_API_URL`, through this app's own server (the session lives in an httpOnly cookie the browser cannot read). See `docs/INTEGRATION.md`.

## Checks

```bash
npm run typecheck && npm run lint && npm run build
```

See `AGENTS.md` for repo rules.
