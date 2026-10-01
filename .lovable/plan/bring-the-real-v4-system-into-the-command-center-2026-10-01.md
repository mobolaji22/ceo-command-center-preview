# Bring the real v4 system into the Command Center

v4 runs only on your computer, so this app can't reach it there. Instead, v4's core records move into this app's own backend (Lovable Cloud). The Command Center and a new Client Center then read and write real data. All sample text (Northstar, the fake dossiers, the fixed date) goes away.

## What you'll get

**1. Sign-in**

- You sign in to the Command Center with email. Only your account has the owner role. Nobody else can open it, even with the link.
- Clients sign in through invite emails and only ever see the Client Center.

**2. Command Center, now with real data** (same look, same scene and hotspots)

- **Computer**
  - Cases & Engagements: your live projects, with their status and priority.
  - Decision Ledger: real decisions, open and resolved.
  - Security/Gov: approval counts and policy status taken from the records.
- **Contracts:** the real approval queue. Approve or reject a request, attach constraints, or ask for more evidence. Each action is saved, stamped with the time, and recorded in the project's event history.
- **Phone:** live counts of signatures waiting, exceptions (blocked or stalled tasks), and recent activity.
- **Brief:** a summary built from real events since your last visit. It shows what changed, what needs your judgment, and what moved forward.
- **Directive:** saves your directive to a project, or as an organization-wide directive, and optionally assign a client to the project/organization and shows a limited/full history of past directives.
- **Corridor rooms:** one room per department, built from the domains/departments that actually exist. A room with no projects yet shows no projects pinned on the walls. It should hold a history of projects it has worked on in a type of flip book/calendar pinned to the wall with dates of when tasked were worked on. This should look at v4-command to replicate the corridor build but build the rooms in style with the rest of this project.

**3. Client Center** (new, separate area with its own simpler look)

- Each client sees only the projects you've linked them to.
- They can see project status, a timeline of updates you choose to share, and deliverables (with file downloads).
- They can approve or reject approvals you mark as needing the client, and leave comments.
- They can see requirements and fill in the ones you ask for (onboarding questions and file uploads). This maps to v4's "context requests".
- You invite a client by email from inside the Command Center and choose which projects they can see.

**4. Your existing v4 records**

- The app starts empty, with no made-up data. Once the build is done, I can import your real records. Export each table to a CSV file from your local v4 database and upload the files here.

## Out of scope for this pass

v4's AI orchestration worker, the controlled terminal, Git workspaces, and the design-intelligence engine. They need a long-running server and can't run inside this app. The data structure keeps room for them, so they can be connected later.

## Technical details

- Enable Lovable Cloud with email sign-in. Add a profiles table and a separate `user_roles` table (roles: `owner`, `client`) with a `has_role()` check.
- Tables mirror the core Prisma models with the same statuses: organizations, projects, tasks, decisions, evidence, approvals, artifacts (deliverables), context_requirements (requirements), outcomes, events, directives. Add a `project_clients` link table plus `client_visible` / `requires_client` flags on events, artifacts, approvals, and requirements.
- Access rules: the owner can read and change everything. A client can only read rows for linked projects that are marked client-visible, can resolve only approvals marked `requires_client` on their projects, and can only update requirements assigned to them.
- A private storage area for deliverables and requirement uploads, with access rules based on project.
- Server functions use the signed-in user's own access (`requireSupabaseAuth`). Client invites run as a server function that checks the owner role, then sends the invite through the admin client.
- Routes:
  - `/` stays as the owner Command Center, now under the sign-in gate.
  - `/auth` for sign-in.
  - `/client` and `/client/projects/$id` for the Client Center.
  - Owner management screens inside the Command Center for projects, clients, and invites.
- Update `AGENTS.md`, since the "local preview state only" rule changes to "real data in Lovable Cloud".