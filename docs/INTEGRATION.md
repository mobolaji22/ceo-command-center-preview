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
| plans.list                                    | GET /v1/projects/:id/proposals (PLAN only; drafts are hidden from clients) |
| plans.changes                                 | GET /v1/proposals/:id/diff |
| plans.decide                                  | POST /v1/proposals/:id/decision (`APPROVE` / `REQUEST_REVISION` / `REJECT`; a revision answers with the next version) |
| plans.decisions                               | GET /v1/projects/:id/decisions |
| plans.delegations / revokeDelegation          | GET /v1/projects/:id/delegations, POST /v1/delegations/:id/revoke |
| plans.mayDecideForClient                      | GET /v1/organizations/:id/permissions (a `DECIDE_ON_BEHALF` permission naming the plan, or standing and covering it) |
| runs.list                                     | GET /v1/projects/:id/runs (the work of an approved plan, with each step and why it is waiting) |
| runs.budget                                   | GET /v1/projects/:id/budget (how much of the approved budget is used: totals only; the cost records are the agency's and are not read here) |
| runs.pause / resume / cancel                  | POST /v1/projects/:id/pause, /resume, /cancel (the decision owner and the CEO; only the side that held the work can lift it; the API's refusal is shown as it is) |
| questions.list                                | GET /v1/interventions?status=live[&projectId=] (each person gets only what is asked of them; the agency also gets `detail`) |
| questions.answer                              | POST /v1/interventions/:id/resolve (`option`, `note`, `params.toUsd`, `params.evidence`) |
| briefs.list / get / verify                    | GET /v1/briefs[?projectId=&type=], GET /v1/briefs/:id (statements with their sources), GET /v1/briefs/:id/verify (opens every source; a client reads only what was written to their organization) |
| notifications.list                            | GET /v1/notifications (what was sent to the signed-in person, or waits for the digest) |
| notifications.preferences / savePreferences   | GET, PUT /v1/me/notification-preferences (timezone, quiet hours, the level that interrupts (3 to 5), email, digest) |
| actionLinks.describe / confirm                | GET /v1/action-links/:token (changes nothing), POST /v1/action-links/:token/confirm with `{ confirm: true }` (public: the signed token is the credential; only RESUME, RETRY and REWORK; once). The page is `/act/:token`; it never answers on opening |
| standing.list / grant                         | GET, POST /v1/organizations/:id/standing-policies (the client's owner; needs the emailed code; named kinds of work for 7, 30 or 90 days; never above risk 3, hard to undo, or publishing, sending, deleting, paying; no spending of its own). Taken back with plans.revokeDelegation |
| audit.chain                                   | GET /v1/organizations/:id/audit (a client's tamper-evident record of decisions made for them and permissions given, with a verdict on whether each entry still follows the one before; the Computer's Security/Gov tab shows the verdict and the latest entries, never the contents) |
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

## Design documents (not yet served by the API; superseded design below)

The Design Workshop (the Design room's monitors in the command center) edits a **structured design document** per project, the
"SDD" described in the Design Intelligence Contract (v15, Stage 5). The browser reaches it only through `DataSource.design`.

> **Do not build `/v1/projects/:id/design-document`.** v4 keeps `DesignState` as the one design record, and a Workshop session is a
> branch of it (Design §7.7; dev-playbook-v4 ADR-0016, slice P6.10b): open a session, autosave the branch with a revision, every edit
> an override with its token level, commit runs one critique of the net diff, and the branch merges on a pass. The routes are
> designed in P6.10b once Design v15 is in `docs/contracts`; `design.load/save` will be re-pointed at them then. The table below is
> what the Workshop was written against and stays only as a record of what the editor needs (load, revisioned save, conflict).

| Call (superseded) | Request | Success | Failure the UI handles |
|---|---|---|---|
| `design.load(projectId)` | `GET /v1/projects/:id/design-document` | `200` the document, or `404` when none exists yet (the Workshop then starts from territory exploration output) | any error is shown, with Try again |
| `design.save(doc, baseRevision)` | `PUT /v1/projects/:id/design-document` body `{ baseRevision, document }` | `200 { revision }` | `409 REVISION_CONFLICT` when `baseRevision` is not the stored revision (nobody's work is overwritten; the editor offers Reload); `403` when the person may not edit |

Rules the API owns, not the browser:

- **Approval authority.** The document carries `approvals[]` entries (frame, revision, who, when, reopened or not). The browser records
  them, but they are *drafts of intent*: what an approval allows is decided by v4's authority policy, which the Workshop does not
  duplicate. Until the API confirms a save, the UI says the design is kept on the device only.
- **Revision.** `revision` increases on every committed change; undo, redo and restore are new revisions too, so the record only moves
  forward. `revisions[]` and `decisionLog[]` are append-only history for attribution.
- **Schema.** `schemaVersion` is `sdd/1-lite` (`src/lib/design/sdd.ts`). Validate it and refuse unknown versions.

`capabilities.designDocuments` is `false` in `api.ts` until v4 serves Workshop sessions (P6.10b). While it is false the Workshop works fully, but
keeps a working copy in this browser (`src/lib/design/draft-store.ts`), shows a notice saying so, and offers JSON and SVG export so the
design can be shared. Flipping the flag to `true` makes `design.load/save` the system of record with no UI change. The demo data source
(`fixtures.ts`) implements the same interface on top of the same local store.

The territory-exploration capability that produces the first document is represented by `src/lib/design/sample.ts` (the fixture
provider: three territories, each with a desktop and a mobile frame, tokens and a twelve-part genome). A model-backed provider replaces
it by returning the same shape; likewise `src/lib/design/proposals.ts` (`ProposalProvider`) for scoped suggestions that are shown
before and after and never applied until a person accepts them.

## Rooms (P6.10a)

The corridor's rooms come from `GET /v1/domains` (dev-playbook-v4 ADR-0017) through `queries.domains()` and the shared
`useDomains()` read (`src/lib/domains.ts`): every domain in order with its name and pack. The "Other" room for older records is the
only room not from that read. `npm run lint` fails if a list of domain codes appears outside the demo fixtures
(`scripts/check-domain-lists.mjs`).

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

## Pages an email opens

- `/act/:token` answers one low-consequence question without signing in. It describes the question and what answering would do, and answers only when the button is pressed (mail scanners open links). Its address carries a credential, so the page sends no referrer and asks not to be indexed.
- `/briefs/:id` is a brief on a page of its own. Without a session it asks you to sign in and then brings you back to the brief: the destination is kept in local storage for 30 minutes (the sign-in link usually opens in another tab), read once, and limited to `/briefs/:id` so it can never send anyone anywhere else.
