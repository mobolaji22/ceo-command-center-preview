# Integration with dev-playbook-v4

The UI talks to data through one interface, `DataSource` (`src/lib/data/types.ts`).
`NEXT_PUBLIC_DATA_SOURCE=fixtures|api` selects the implementation.

## Endpoint map (`src/lib/data/api.ts`)

These are the endpoints the v4 API must provide. Until one exists the call fails with a clear error.

| DataSource call                                           | Endpoint                                       |
| --------------------------------------------------------- | ---------------------------------------------- |
| auth.getSession                                           | GET /v1/auth/session                           |
| auth.signInWithPassword                                   | POST /v1/auth/sign-in                          |
| auth.requestPasswordReset                                 | POST /v1/auth/password-reset                   |
| auth.hasRecoverySession                                   | GET /v1/auth/recovery                          |
| auth.setPassword                                          | POST /v1/auth/password                         |
| auth.signOut                                              | POST /v1/auth/sign-out                         |
| queries.ownerData                                         | GET /v1/console/overview                       |
| queries.clientData                                        | GET /v1/portal/overview                        |
| commands.resolveApproval / clientResolveApproval          | POST /v1/interventions/:id/resolve             |
| commands.setApprovalConstraints / requestApprovalEvidence | PATCH /v1/interventions/:id                    |
| commands.issueDirective                                   | POST /v1/intents (source CEO_DIRECTIVE)        |
| commands.markSeen                                         | POST /v1/console/seen                          |
| commands.createOrganization                               | POST /v1/organizations                         |
| commands.inviteClient                                     | POST /v1/invitations                           |
| commands.unlinkClient                                     | DELETE /v1/projects/:id/members/:userId        |
| commands.createProject / setProjectStatus                 | POST /v1/projects, PATCH /v1/projects/:id      |
| commands.addDeliverable                                   | POST /v1/projects/:id/deliverables (multipart) |
| commands.postUpdate                                       | POST /v1/projects/:id/updates                  |

Every non-GET request carries an `Idempotency-Key`. Requests use `credentials: "include"`; the
browser never holds a token. Seeding commands (tasks, evidence, outcomes, ...) are records the
runtime creates, so they return an error in `api` mode and their forms are hidden
(`capabilities.seedRecords`).

The read models (`src/lib/model.ts`) are "read-model v0", derived from the preview. They are to be
replaced by types generated from `packages/contracts` in v4 (phase P0/CC-1).

## Deviations from the preview

- Framework: TanStack Start to Next.js App Router; Supabase and server functions removed.
- No self sign-up: access is by invitation only.
- `approval-queue` and other screens (auth, Manage, room pinboard/flipbook, empty states, client)
  had no CSS in the preview; `src/app/screens.css` completes them.
- A Client Center shell (`/client`) was added; clients are redirected there and cannot reach `/`.
- Footer label reads "LIVE FROM DEVPLAYBOOK V4" (api) or "DEMO FIXTURES" (fixtures).
- Greeting uses the session's display name.
- Fixture mode shows a "DEMO DATA" banner.

## Environment

See `.env.example`: `NEXT_PUBLIC_DATA_SOURCE`, `NEXT_PUBLIC_V4_API_URL`, `NEXT_PUBLIC_ALLOW_FIXTURES`.
