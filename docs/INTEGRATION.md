# Integration with dev-playbook-v4

The UI talks to data through one interface, `DataSource` (`src/lib/data/types.ts`).
`NEXT_PUBLIC_DATA_SOURCE=fixtures|api` selects the implementation.

## How the browser reaches the API (the BFF)

The browser never talks to v4 and never holds a credential. Every call goes to this app's own server (`src/app/api`),
which reads the session from an **httpOnly, SameSite=Lax cookie** (`dpb_session`) and forwards the request with
`Authorization: Bearer <session>`.

| Route (this app)                         | What it does |
| ---------------------------------------- | ------------ |
| `GET /api/session`                       | Who is signed in (`/v1/me`), reshaped for the UI. Clears a cookie the API no longer honours. |
| `POST /api/auth/request`                 | Asks v4 to email a sign-in link and code. Same answer whether or not the address has an account. |
| `POST /api/auth/verify`                  | Finishes sign-in with the link token, or email + six-digit code. The session secret goes into the cookie; it is never in a response body. |
| `POST /api/auth/accept`                  | Accepts an emailed invitation (creates access and signs in, once). |
| `POST /api/auth/sign-out`                | Revokes the session at v4, then clears the cookie. |
| `ANY /api/v4/v1/...`                     | Generic forward to v4. Refuses `sign-in/verify` and `invitations/accept` (their answers carry the secret), refuses anything outside `/v1/`, and requires the request's `Origin` to be this app. Never forwards the browser's own `Authorization` or `Cookie`. |

Emailed links open `/auth/verify?token=...` and `/auth/accept?token=...`. Opening one only shows a button; the click
spends it, so a mail scanner that fetches the link cannot use it up. There are no passwords and no reset screen (N8).

## Endpoint map (`src/lib/data/api.ts`)

| DataSource call                               | v4 endpoint |
| --------------------------------------------- | ----------- |
| queries.ownerData                             | GET /v1/console/overview (agency only) |
| queries.clientData                            | GET /v1/portal/overview (clients only) |
| commands.resolveApproval / clientResolveApproval | POST /v1/approvals/:id/resolve |
| intents.submit                                | POST /v1/intents (attachments staged first via /v1/assets with `staged`) |
| intents.answer                                | POST /v1/intents/:id/clarifications/:cid/answer |
| intents.respond                               | GET /v1/intents/:id/ask, POST /v1/requirements/:id/respond |
| commands.markSeen                             | POST /v1/console/seen |
| commands.createOrganization                   | POST /v1/organizations (CEO) |
| commands.invitePerson                         | POST /v1/invitations (needs step-up: `/v1/auth/step-up/request` then `/verify`) |
| commands.removePerson                         | DELETE /v1/organizations/:id/members/:userId (CEO) |
| assets.list / upload / downloadLink           | GET/POST /v1/assets, signed `PUT` to the returned link, `POST .../complete`, GET .../download |
| assets.promote / exclude                      | POST /v1/assets/:id/promote, POST /v1/projects/:id/assets/:assetId/exclude |

Not offered by the API yet, so the UI hides them (`capabilities`): constraints and evidence requests on an
authorization (arrive with interventions) and hand-posted timeline updates (the system writes the timeline).

Projects are never created or status-edited by hand: they begin only as intents (`POST /v1/intents`; `/v1/directives` answers 410). Tasks,
approvals, decisions, evidence and outcomes are created by the runtime. The UI has no create-project screen.

The CEO may resolve a **client's** authorization only with a permission the client's owner granted; otherwise the API
answers `PERMISSION_REQUIRED` and the UI says so. Decisions made that way are flagged to the client.

The read models (`src/lib/model.ts`) use the ten v4 project statuses; the API builds them (`apps/api/src/readmodels`).
They are to be replaced by types generated from `packages/contracts`.

## Deviations from the preview

- Framework: TanStack Start to Next.js App Router; Supabase and server functions removed.
- No self sign-up (invitation only) and no project-creation, status or record-seeding screens: projects begin only from intents/directives.
- `approval-queue` and other screens (auth, Manage, room pinboard/flipbook, empty states, client)
  had no CSS in the preview; `src/app/screens.css` completes them.
- A Client Center shell (`/client`) was added; clients are redirected there and cannot reach `/`.
- No password or reset screens: sign-in is an emailed link or code. Accounts are created by invitation only.
- People are managed per organization (owner or member), not per project.
- Footer label reads "LIVE FROM DEVPLAYBOOK V4" (api) or "DEMO FIXTURES" (fixtures).
- Greeting uses the session's display name.
- Fixture mode shows a "DEMO DATA" banner.

## Environment

See `.env.example`: `NEXT_PUBLIC_DATA_SOURCE`, `V4_API_URL` (server only), `APP_ORIGIN`, `NEXT_PUBLIC_ALLOW_FIXTURES`.

## End-to-end tests

`npm run test:e2e` boots the real stack: a scratch Postgres database, the v4 API (`V4_DIR`, default `../dev-playbook-v4`,
with email going to a file the test reads) and this app built against it, then drives Chromium through sign-in by emailed
link and by code, a used link, step-up, an invitation, a client's first sign-in and a file upload that is scanned before
it can be downloaded. Needs `psql`, Postgres (`E2E_PG_ADMIN`, a superuser URL) and Redis. `E2E_SKIP_BUILD=1` reuses a build.
