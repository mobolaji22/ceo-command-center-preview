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
| questions.list                                | GET /v1/interventions?status=live[&projectId=] (each person gets only what is asked of them; the agency also gets `detail`; each option carries the API's `stepUp`, the only source of the "we will email you a code" warning: the UI keeps no list of its own, and the API refuses the answer without a fresh code whatever the UI shows) |
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

## Design documents (v4's SDD; dev-playbook-v4 ADR-0049)

The Design Workshop shows the project's **structured design document** (SDD) as v4 holds it. A Design run's territory exploration
writes the first draft (three territories, each with frames of typed nodes, tokens and the thinking behind it) and asks the client's
owner to choose one; the question links to the project's Workshop. The browser reaches it only through `DataSource.design`.

| Call | Request | Success | Failure the UI handles |
|---|---|---|---|
| `design.read(projectId)` | `GET /v1/projects/:id/sdd` | `200 { approved, current }`: the approved document, and the current draft (`proposalId`, `status`, `baseVersion`, `documentHash`, `document`). The client's owner sees `current` only while the choice is open | any error is shown, with Try again |
| `design.selectTerritory(projectId, territoryId, changes?)` | `POST /v1/projects/:id/sdd/territories/:territoryId/select` body `{ changes? }` | `200`: the open question is answered and the draft is marked with the choice | `409 ALREADY_RESOLVED` when no choice is waiting (already answered); `404 INTERVENTION_NOT_FOUND` when the question is not this person's; `400 INVALID_PARAMS` for a territory not among those asked about |

- **Types are generated, never hand-written.** `npm run sdd:types` reads v4's `packages/contracts/schemas/sdd-document.schema.json`
  (`V4_DIR`, default `../dev-playbook-v4`) and writes a copy of the schema and `src/lib/design/sdd.generated.ts`. `npm run lint` fails
  when the types drift from the copy, or the copy from v4's schema when a v4 checkout is present; the e2e setup checks it too.
- **Wireframes, not renders.** `src/components/cc/workshop/directions.tsx` draws each territory's frames from its node tree (roles and
  layout descriptions) with content *slots* where copy is still to be written. Until v4's renderer (P6.33) fills `previewRefs`, each
  direction says "Not rendered".
- **Choosing is v4's.** "Choose" and "Choose with changes" call `selectTerritory`; who may choose, and what a choice changes, is decided
  by v4. The answer to the run's question in the client's questions (by number) is the fallback path and resolves the same item.

Editing in the Workshop still keeps a working copy in this browser (`src/lib/design/draft-store.ts`, schema `sdd/1-lite`) and is shown only
with the demo data source; `capabilities.designDocuments` stays `false` in `api.ts`. Moving editing onto v4's document (typed annotations,
revisioned saves) is the next slice (W4b), which retires `sdd/1-lite` and `/v1/projects/:id/design-document`, a route v4 never served.

## Rooms (P6.10a)

The corridor's rooms come from `GET /v1/domains` (dev-playbook-v4 ADR-0017) through `queries.domains()` and the shared
`useDomains()` read (`src/lib/domains.ts`): every domain in order with its name and pack. The "Other" room for older records is the
only room not from that read. `npm run lint` fails if a list of domain codes appears outside the demo fixtures
(`scripts/check-domain-lists.mjs`).

## Addresses, the palette and keys

Where you are is in the address bar (`src/lib/place.ts`), so Back, Forward, a refresh and a link all work. Only these keys
are the app's; anything else in the address (the demo's `?as=`) is left alone.

| Address | Opens |
| --- | --- |
| `/?desk=contracts&project=<id>&item=<approval id>` | a CEO desk (`computer`, `phone`, `contracts`, `directive`, `brief`, `records`, `settings`), optionally on one project or authorization |
| `/?at=corridor` | the corridor |
| `/?room=DESIGN` · `/?room=DESIGN&spot=workshop` | a department room, or one of its objects (`wall`, `calendar`, `desk`, `workshop`); an unknown room goes to the corridor |
| `/client?desk=decisions` · `/client?desk=projects&project=<id>` | a client desk (`projects`, `decisions`, `requests`, `library`, `briefs`, `settings`) |

⌘K (Ctrl K) opens the palette in both rooms (`src/components/cc/command-palette.tsx`): what is waiting on you, the desks,
the rooms, the projects and a few actions, built from data already on screen. Single letters open desks (`?` lists them);
they are off when typing, inside the Design Workshop, or when switched off on that list (kept per browser, like the
lighting). In Contracts, A or R only arms approve or reject; Enter decides and Escape lets go, so a stray letter never signs.

Kept in the browser, never in the API, because each is a viewing convenience for one person:

- **Filters** (`useRemembered` in `src/lib/find.ts`): what was typed or chosen in a desk's find bar comes back the next time
  that desk opens, for the rest of the visit (session storage). A remembered filter for something no longer on the list falls
  back to all.
- **Recent rooms**: the palette lists the last three rooms visited first, for this visit only.

**Decisions are instant on screen, not in the record.** Approving or rejecting an authorization (the CEO's Contracts desk, the
client's Decisions desk) takes it off the queue the moment it is sent and opens the next one; the API's answer confirms it, and
an authorization the API refuses comes back with the reason. Nothing on screen says "granted" until the API has said so.

**Status colours** (`statusTone` in `src/lib/format.ts`) come from one map over the read model's status types, in four
families: waiting on someone (amber), done or going well (green), refused or broken (muted red), information (slate). A
status the API adds fails the typecheck until it is given a family.

## Live updates

**Now: polling.** Every query on screen is read again every 20 seconds while the tab is visible (`LIVE_MS` in
`src/app/providers.tsx`); a hidden tab asks nothing. Queries whose answer only changes when you change it (a brief, your
settings and notification preferences, the domain list, the audit chains) are marked `meta: { static: true }` and are not
polled. In demo mode the fixtures also refresh across tabs and the monitor's frames through the `storage` event.

**Next: the stream (planned, not built).** v4 already serves Server-Sent Events (`apps/api/src/routes/events-stream.ts`):
`/v1/events/stream` for the agency, `/v1/organizations/:id/events/stream` for a client's organization and
`/v1/projects/:id/events/stream` per project. Frames are pointers with metadata (type, project, organization), never
payloads, and access is re-checked while a stream is open. The BFF already streams response bodies, so the plan is:

1. `DataSource` gains `live.subscribe(onEvent): unsubscribe`. `api.ts` opens an `EventSource` on
   `/api/v4/v1/events/stream` (CEO) or `/api/v4/v1/organizations/<id>/events/stream` (client); `fixtures.ts` raises the
   same events from its `storage` listener, so both sides share one code path.
2. One small map from event namespace to the queries it makes stale (for example, `approval.*` → overview and
   questions; `run.*` → that project's case file) invalidates only those. The names come from `packages/contracts` (lowercase
   dotted, never hand-typed here).
3. While the stream is connected, polling drops to a slow safety net (60 seconds); when it drops, the app reconnects
   with backoff and goes back to 20-second polling until it is back. "Live ledger" shows which of the two is in force.
4. Before building: check that the host lets the BFF hold a response open (a serverless function has a maximum duration,
   so the browser must expect the stream to end and reconnect), and add an HTTP-level test that a client's stream never
   carries another organization's events (plan R11).

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
