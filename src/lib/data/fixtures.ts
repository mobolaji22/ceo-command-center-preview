import type {
  Approval,
  ClientData,
  OwnerData,
  Profile,
  Project,
  Session,
  V4Event,
} from "../model";
import { fail, ok, type DataSource, type Result } from "./types";

/**
 * Fixtures DataSource: an in-memory, localStorage-persisted demo of the Command Center's data.
 *
 * It exists so the UI can be designed, reviewed and developed without a backend. It is NOT a
 * second source of truth: it holds fictional records only, the app shows a DEMO banner while
 * it is active, and nothing here is ever used in a production build (see lib/data/index.ts).
 *
 * It imitates server behaviour that the real API owns: events are appended by commands, and
 * client visibility is decided here the way the API will decide it.
 */

const STORE_KEY = "dpl.fixtures.v1";
const SESSION_KEY = "dpl.fixtures.session";
const CHANGE_EVENT = "dpl:fixtures-change";

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
const id = () => crypto.randomUUID();

type User = { id: string; email: string; displayName: string; role: "owner" | "client" };

type Store = { data: OwnerData; users: User[]; lastSeen: string | null };

function seed(): Store {
  const users: User[] = [
    { id: "u-ceo", email: "ceo@example.com", displayName: "Ola", role: "owner" },
    { id: "u-amara", email: "amara@northwind.example", displayName: "Amara Eze", role: "client" },
    { id: "u-tunde", email: "tunde@lumen.example", displayName: "Tunde Bello", role: "client" },
  ];
  const clients: Profile[] = users
    .filter((u) => u.role === "client")
    .map((u) => ({ id: u.id, email: u.email, display_name: u.displayName, created_at: ago(24 * 40) }));

  const projects: Project[] = [
    { id: "p-1", organization_id: "o-1", name: "Northwind storefront redesign", description: "Redesign the online storefront and ordering flow.", objective: "Lift online orders by 25% in a quarter", status: "IN_PROGRESS", priority: 80, domains: ["Brand", "Design", "Engineering"], created_at: ago(24 * 18), started_at: ago(24 * 16), completed_at: null },
    { id: "p-2", organization_id: "o-2", name: "Lumen patient onboarding flow", description: "A calmer, shorter intake for new patients.", objective: "Cut intake abandonment in half", status: "WAITING_FOR_HUMAN", priority: 70, domains: ["Strategy", "Design", "Content"], created_at: ago(24 * 11), started_at: ago(24 * 9), completed_at: null },
    { id: "p-3", organization_id: "o-3", name: "Portfolio v2", description: "The agency's own portfolio.", objective: "Win two inbound enquiries a month", status: "PLANNED", priority: 50, domains: ["Design", "Engineering"], created_at: ago(24 * 5), started_at: null, completed_at: null },
    { id: "p-4", organization_id: "o-1", name: "Northwind brand audit", description: "Audit of the existing brand system.", objective: "Know what to keep and what to retire", status: "COMPLETED", priority: 40, domains: ["Brand"], created_at: ago(24 * 60), started_at: ago(24 * 58), completed_at: ago(24 * 35) },
  ];

  const data: OwnerData = {
    projects,
    tasks: [
      { id: "t-1", project_id: "p-1", title: "Define the meaning model", domain: "Design", status: "COMPLETED", risk: 2, reversibility: 4, approval_required: false, description: null, created_at: ago(24 * 15), started_at: ago(24 * 15), completed_at: ago(24 * 14) },
      { id: "t-2", project_id: "p-1", title: "Explore three design territories", domain: "Design", status: "COMPLETED", risk: 1, reversibility: 4, approval_required: false, description: null, created_at: ago(24 * 14), started_at: ago(24 * 14), completed_at: ago(24 * 12) },
      { id: "t-3", project_id: "p-1", title: "Build the storefront composition", domain: "Engineering", status: "RUNNING", risk: 2, reversibility: 4, approval_required: false, description: null, created_at: ago(24 * 6), started_at: ago(24 * 3), completed_at: null },
      { id: "t-4", project_id: "p-1", title: "Connect checkout to payments", domain: "Engineering", status: "BLOCKED", risk: 4, reversibility: 2, approval_required: true, description: null, created_at: ago(24 * 2), started_at: null, completed_at: null },
      { id: "t-5", project_id: "p-2", title: "Map the current intake journey", domain: "Strategy", status: "COMPLETED", risk: 1, reversibility: 5, approval_required: false, description: null, created_at: ago(24 * 8), started_at: ago(24 * 8), completed_at: ago(24 * 7) },
      { id: "t-6", project_id: "p-2", title: "Publish the new intake form", domain: "Engineering", status: "WAITING_FOR_HUMAN", risk: 4, reversibility: 2, approval_required: true, description: null, created_at: ago(24 * 1), started_at: null, completed_at: null },
      { id: "t-7", project_id: "p-3", title: "Draft the portfolio narrative", domain: "Content", status: "READY", risk: 1, reversibility: 5, approval_required: false, description: null, created_at: ago(24 * 2), started_at: null, completed_at: null },
    ],
    decisions: [
      { id: "d-1", project_id: "p-1", question: "Which design territory should the storefront follow?", options: ["Warm editorial", "Playful modern", "Austere minimal"], recommendation: "Warm editorial", status: "WAITING_FOR_HUMAN", confidence: 0.72, risk: 2, reversibility: 4, rationale: null, selected_option: null, created_at: ago(30), resolved_at: null },
      { id: "d-2", project_id: "p-2", question: "Should intake be one page or a short sequence?", options: ["One page", "Three short steps"], recommendation: "Three short steps", status: "ACCEPTED", confidence: 0.8, risk: 2, reversibility: 4, rationale: "Less cognitive load per screen.", selected_option: "Three short steps", created_at: ago(24 * 6), resolved_at: ago(24 * 5) },
      { id: "d-3", project_id: "p-4", question: "Retire the secondary logo?", options: ["Retire", "Keep"], recommendation: "Retire", status: "ACCEPTED", confidence: 0.9, risk: 1, reversibility: 5, rationale: null, selected_option: "Retire", created_at: ago(24 * 40), resolved_at: ago(24 * 38) },
    ],
    approvals: [
      { id: "a-1", project_id: "p-2", target_type: "TASK", title: "Publish the redesigned intake form to production", reason: "The new three-step intake passed every quality gate and testing on staging. Publishing makes it live to real patients, so it needs a human signature.", recommendation: "Approve, with a 7-day watch on abandonment.", consequences: "Real patients see the new form immediately. Rolling back is possible but patient submissions during the window cannot be un-submitted.", risk: 4, reversibility: 2, requires_client: true, status: "REQUESTED", constraints: null, evidence_request: null, resolution_note: null, resolved_at: null, resolved_by: null, created_at: ago(20) },
      { id: "a-2", project_id: "p-1", target_type: "DECISION", title: "Select the 'Warm editorial' territory for the storefront", reason: "Territory critique kept two of three candidates; 'Warm editorial' is the only one a competitor could not adopt in a weekend.", recommendation: "Select 'Warm editorial'.", consequences: "Locks the visual direction the rest of the build follows. Reversible, at the cost of rework.", risk: 2, reversibility: 4, requires_client: false, status: "REQUESTED", constraints: null, evidence_request: null, resolution_note: null, resolved_at: null, resolved_by: null, created_at: ago(28) },
      { id: "a-3", project_id: "p-3", target_type: "PROJECT", title: "Start the portfolio build", reason: "Scope, budget and timeline are agreed.", recommendation: "Approve.", consequences: "Opens the build phase.", risk: 1, reversibility: 5, requires_client: false, status: "GRANTED", constraints: null, evidence_request: null, resolution_note: null, resolved_at: ago(24 * 2), resolved_by: "u-ceo", created_at: ago(24 * 3) },
      { id: "a-4", project_id: "p-1", target_type: "TASK", title: "Switch the payment provider", reason: "A cheaper provider was proposed mid-build.", recommendation: "Reject: not in the approved scope.", consequences: "Would change fees and the checkout contract.", risk: 4, reversibility: 2, requires_client: true, status: "REJECTED", constraints: null, evidence_request: null, resolution_note: "Out of scope for this phase.", resolved_at: ago(24 * 4), resolved_by: "u-ceo", created_at: ago(24 * 5) },
    ],
    evidence: [
      { id: "e-1", project_id: "p-2", approval_id: "a-1", claim: "All 14 intake form quality gates passed on staging.", source: "quality-gate run #218", source_type: "SYSTEM", confidence: 0.95, created_at: ago(22) },
      { id: "e-2", project_id: "p-2", approval_id: "a-1", claim: "Median completion time fell from 9m 10s to 4m 40s in staging tests.", source: "usability session notes", source_type: "HUMAN", confidence: 0.78, created_at: ago(21) },
      { id: "e-3", project_id: "p-1", approval_id: "a-2", claim: "Two of the three territories failed the Generic Design Detector against current competitors.", source: "territory critique", source_type: "SYSTEM", confidence: 0.82, created_at: ago(29) },
      { id: "e-4", project_id: "p-1", approval_id: null, claim: "Competitor sites in this vertical overwhelmingly use centred hero + stock photography.", source: "competitive snapshot", source_type: "SYSTEM", confidence: 0.7, created_at: ago(24 * 13) },
    ],
    artifacts: [
      { id: "f-1", project_id: "p-1", type: "deliverable", name: "Brand audit summary", description: "What to keep, what to retire.", storage_path: null, status: "FINAL", client_visible: true, created_at: ago(24 * 35) },
      { id: "f-2", project_id: "p-1", type: "deliverable", name: "Territory exploration deck", description: "Three directions, with critique.", storage_path: null, status: "PROPOSED", client_visible: true, created_at: ago(24 * 12) },
      { id: "f-3", project_id: "p-2", type: "deliverable", name: "Intake journey map", description: "Where patients drop off today.", storage_path: null, status: "FINAL", client_visible: true, created_at: ago(24 * 7) },
    ],
    requirements: [
      { id: "r-1", project_id: "p-1", name: "Brand guidelines", description: "The current brand guide and logo files.", category: "general", required: true, status: "RECEIVED", reason: "Needed to keep the redesign consistent.", assigned_to_client: true, deadline: null, resolved_at: ago(24 * 15), response: "Uploaded to the shared folder.", response_file_path: null, created_at: ago(24 * 17) },
      { id: "r-2", project_id: "p-1", name: "Last quarter's order data", description: "A CSV export of online orders.", category: "general", required: true, status: "REQUESTED", reason: "Needed to measure the baseline.", assigned_to_client: true, deadline: null, resolved_at: null, response: null, response_file_path: null, created_at: ago(24 * 2) },
      { id: "r-3", project_id: "p-2", name: "Compliance wording for the intake form", description: "Approved consent and privacy text.", category: "general", required: true, status: "REQUESTED", reason: "Must be present before publishing.", assigned_to_client: true, deadline: null, resolved_at: null, response: null, response_file_path: null, created_at: ago(24 * 3) },
      { id: "r-4", project_id: "p-3", name: "Case-study permissions", description: "Which past projects may be shown.", category: "general", required: false, status: "MISSING", reason: "Internal.", assigned_to_client: false, deadline: null, resolved_at: null, response: null, response_file_path: null, created_at: ago(24 * 4) },
    ],
    outcomes: [
      { id: "o-1", project_id: "p-4", metric: "Brand consistency score", expected_value: "70", actual_value: "84", interpretation: null, created_at: ago(24 * 30) },
    ],
    events: [
      { id: "ev-1", project_id: "p-2", type: "APPROVAL_REQUESTED", summary: "Approval requested: Publish the redesigned intake form to production", actor_id: null, client_visible: true, created_at: ago(20) },
      { id: "ev-2", project_id: "p-1", type: "APPROVAL_REQUESTED", summary: "Approval requested: Select the 'Warm editorial' territory for the storefront", actor_id: null, client_visible: false, created_at: ago(28) },
      { id: "ev-3", project_id: "p-1", type: "TASK_BLOCKED", summary: "Connect checkout to payments is blocked: waiting on provider credentials", actor_id: null, client_visible: false, created_at: ago(26) },
      { id: "ev-4", project_id: "p-1", type: "TASK_STARTED", summary: "Build the storefront composition started", actor_id: null, client_visible: true, created_at: ago(24 * 3) },
      { id: "ev-5", project_id: "p-3", type: "APPROVAL_GRANTED", summary: "CEO approved: Start the portfolio build", actor_id: "u-ceo", client_visible: false, created_at: ago(24 * 2) },
      { id: "ev-6", project_id: "p-1", type: "APPROVAL_REJECTED", summary: "CEO rejected: Switch the payment provider", actor_id: "u-ceo", client_visible: true, created_at: ago(24 * 4) },
      { id: "ev-7", project_id: "p-2", type: "DECISION_RECORDED", summary: "Decision recorded: three short steps for intake", actor_id: "u-ceo", client_visible: true, created_at: ago(24 * 5) },
      { id: "ev-8", project_id: "p-2", type: "DELIVERABLE_SHARED", summary: "Deliverable: Intake journey map", actor_id: "u-ceo", client_visible: true, created_at: ago(24 * 7) },
      { id: "ev-9", project_id: "p-1", type: "CONTEXT_RECEIVED", summary: "Client provided: Brand guidelines", actor_id: "u-amara", client_visible: true, created_at: ago(24 * 15) },
      { id: "ev-10", project_id: "p-4", type: "PROJECT_COMPLETED", summary: "Project completed: Northwind brand audit", actor_id: null, client_visible: true, created_at: ago(24 * 35) },
      { id: "ev-11", project_id: "p-3", type: "PROJECT_CREATED", summary: "Project opened: Portfolio v2", actor_id: "u-ceo", client_visible: false, created_at: ago(24 * 5) },
    ],
    directives: [
      { id: "dv-1", content: "Clarify our Q4 priorities and drop anything that does not move online orders.", project_id: null, organization_id: "o-1", client_id: null, created_by: "u-ceo", created_at: ago(24 * 6) },
      { id: "dv-2", content: "Make the patient intake feel calm. Fewer fields, plainer words.", project_id: "p-2", organization_id: "o-2", client_id: "u-tunde", created_by: "u-ceo", created_at: ago(24 * 10) },
    ],
    organizations: [
      { id: "o-1", name: "Northwind Bakery", mission: "Fresh bread, honestly made.", created_at: ago(24 * 70) },
      { id: "o-2", name: "Lumen Health", mission: "Care that feels unhurried.", created_at: ago(24 * 50) },
      { id: "o-3", name: "DevPlaybook (internal)", mission: "The agency's own work.", created_at: ago(24 * 90) },
    ],
    clients,
    links: [
      { project_id: "p-1", user_id: "u-amara", created_at: ago(24 * 18) },
      { project_id: "p-4", user_id: "u-amara", created_at: ago(24 * 60) },
      { project_id: "p-2", user_id: "u-tunde", created_at: ago(24 * 11) },
    ],
  };
  return { data, users, lastSeen: ago(24 * 2) };
}

function load(): Store {
  if (typeof window === "undefined") return seed();
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* fall through to a fresh seed */
  }
  const fresh = seed();
  save(fresh);
  return fresh;
}

function save(s: Store) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: the demo still works for this page view */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const toSession = (u: User): Session => ({ userId: u.id, email: u.email, displayName: u.displayName, role: u.role });

export function createFixturesDataSource(): DataSource {
  const mutate = (fn: (s: Store) => void): Result => {
    const s = load();
    fn(s);
    save(s);
    return ok(undefined as void);
  };
  const addEvent = (s: Store, e: Omit<V4Event, "id" | "created_at" | "actor_id"> & { actor_id?: string | null }) => {
    s.data.events.unshift({ id: id(), created_at: new Date().toISOString(), actor_id: e.actor_id ?? currentUserId(), ...e });
  };
  const currentUserId = () => (typeof window === "undefined" ? null : window.localStorage.getItem(SESSION_KEY));
  const approvalById = (s: Store, aid: string): Approval | undefined => s.data.approvals.find((a) => a.id === aid);

  return {
    kind: "fixtures",
    capabilities: { seedRecords: true },

    auth: {
      async getSession() {
        const uid = currentUserId();
        if (!uid) return null;
        const u = load().users.find((x) => x.id === uid);
        return u ? toSession(u) : null;
      },
      async signInWithPassword(email, password) {
        if (password.length < 8) return fail("Password must be at least 8 characters.");
        const u = load().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
        if (!u) return fail("No demo account for that email. Try ceo@example.com or amara@northwind.example.");
        window.localStorage.setItem(SESSION_KEY, u.id);
        window.dispatchEvent(new Event(CHANGE_EVENT));
        return ok(toSession(u));
      },
      async requestPasswordReset() {
        return ok(undefined as void);
      },
      async hasRecoverySession() {
        return true;
      },
      async setPassword(password) {
        if (password.length < 8) return fail("Password must be at least 8 characters.");
        const uid = currentUserId();
        const u = uid ? load().users.find((x) => x.id === uid) : load().users[0];
        if (!u) return fail("No account.");
        window.localStorage.setItem(SESSION_KEY, u.id);
        return ok(toSession(u));
      },
      async signOut() {
        window.localStorage.removeItem(SESSION_KEY);
        window.dispatchEvent(new Event(CHANGE_EVENT));
      },
      subscribe(onChange) {
        const h = () => onChange();
        window.addEventListener(CHANGE_EVENT, h);
        window.addEventListener("storage", h);
        return () => {
          window.removeEventListener(CHANGE_EVENT, h);
          window.removeEventListener("storage", h);
        };
      },
    },

    queries: {
      async ownerData() {
        return structuredClone(load().data);
      },
      async clientData(): Promise<ClientData> {
        const s = load();
        const uid = currentUserId();
        const mine = new Set(s.data.links.filter((l) => l.user_id === uid).map((l) => l.project_id));
        return structuredClone({
          projects: s.data.projects.filter((p) => mine.has(p.id)),
          events: s.data.events.filter((e) => e.client_visible && e.project_id && mine.has(e.project_id)),
          artifacts: s.data.artifacts.filter((a) => a.client_visible && mine.has(a.project_id)),
          approvals: s.data.approvals.filter((a) => a.requires_client && mine.has(a.project_id)),
          requirements: s.data.requirements.filter((r) => r.assigned_to_client && mine.has(r.project_id)),
        });
      },
    },

    commands: {
      async resolveApproval(aid, approved) {
        return mutate((s) => {
          const a = approvalById(s, aid);
          if (!a) return;
          a.status = approved ? "GRANTED" : "REJECTED";
          a.resolved_by = currentUserId();
          a.resolved_at = new Date().toISOString();
          addEvent(s, { project_id: a.project_id, type: approved ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED", summary: `CEO ${approved ? "approved" : "rejected"}: ${a.title}`, client_visible: a.requires_client });
        });
      },
      async setApprovalConstraints(aid, text) {
        return mutate((s) => {
          const a = approvalById(s, aid);
          if (!a) return;
          a.constraints = text;
          addEvent(s, { project_id: a.project_id, type: "APPROVAL_UPDATED", summary: `Constraints set on: ${a.title}`, client_visible: a.requires_client });
        });
      },
      async requestApprovalEvidence(aid, text) {
        return mutate((s) => {
          const a = approvalById(s, aid);
          if (!a) return;
          a.evidence_request = text;
          addEvent(s, { project_id: a.project_id, type: "APPROVAL_UPDATED", summary: `Evidence requested on: ${a.title}`, client_visible: a.requires_client });
        });
      },
      async clientResolveApproval(aid, approved, note) {
        return mutate((s) => {
          const a = approvalById(s, aid);
          if (!a || !a.requires_client || a.status !== "REQUESTED") return;
          a.status = approved ? "GRANTED" : "REJECTED";
          a.resolution_note = note.slice(0, 2000);
          a.resolved_by = currentUserId();
          a.resolved_at = new Date().toISOString();
          addEvent(s, { project_id: a.project_id, type: approved ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED", summary: `Client ${approved ? "approved" : "rejected"}: ${a.title}`, client_visible: true });
        });
      },

      async issueDirective(input) {
        return mutate((s) => {
          s.data.directives.unshift({ id: id(), content: input.content, project_id: input.projectId, organization_id: input.organizationId, client_id: input.clientId, created_by: currentUserId() ?? "u-ceo", created_at: new Date().toISOString() });
          if (input.clientId && input.projectId && !s.data.links.some((l) => l.project_id === input.projectId && l.user_id === input.clientId)) {
            s.data.links.push({ project_id: input.projectId, user_id: input.clientId, created_at: new Date().toISOString() });
          }
          addEvent(s, { project_id: input.projectId, type: "DIRECTIVE_ISSUED", summary: `Directive: ${input.content.slice(0, 120)}`, client_visible: false });
        });
      },

      async markSeen() {
        const s = load();
        const prev = s.lastSeen;
        s.lastSeen = new Date().toISOString();
        save(s);
        return prev;
      },

      async createOrganization(input) {
        return mutate((s) => {
          s.data.organizations.push({ id: id(), name: input.name, mission: input.mission, created_at: new Date().toISOString() });
        });
      },
      async inviteClient(input) {
        const s = load();
        const email = input.email.trim().toLowerCase();
        let u = s.users.find((x) => x.email === email);
        const invited = !u;
        if (u?.role === "owner") return fail("That email belongs to the owner account.");
        if (!u) {
          u = { id: id(), email, displayName: email.split("@")[0] ?? email, role: "client" };
          s.users.push(u);
          s.data.clients.push({ id: u.id, email, display_name: u.displayName, created_at: new Date().toISOString() });
        }
        for (const pid of input.projectIds) {
          if (!s.data.links.some((l) => l.project_id === pid && l.user_id === u!.id)) {
            s.data.links.push({ project_id: pid, user_id: u.id, created_at: new Date().toISOString() });
          }
        }
        save(s);
        return ok({ invited });
      },
      async unlinkClient(projectId, userId) {
        return mutate((s) => {
          s.data.links = s.data.links.filter((l) => !(l.project_id === projectId && l.user_id === userId));
        });
      },
      async createProject(input) {
        const s = load();
        const p: Project = { id: id(), organization_id: input.organization_id, name: input.name, description: input.description, objective: input.objective, priority: input.priority, domains: input.domains, status: "INTENT", created_at: new Date().toISOString(), started_at: null, completed_at: null };
        s.data.projects.unshift(p);
        addEvent(s, { project_id: p.id, type: "PROJECT_CREATED", summary: `Project opened: ${p.name}`, client_visible: true });
        save(s);
        return ok(p);
      },
      async setProjectStatus(projectId, status) {
        return mutate((s) => {
          const p = s.data.projects.find((x) => x.id === projectId);
          if (!p) return;
          p.status = status;
          if (status === "COMPLETED") p.completed_at = new Date().toISOString();
          if (status === "IN_PROGRESS" && !p.started_at) p.started_at = new Date().toISOString();
          addEvent(s, { project_id: p.id, type: "PROJECT_STATUS", summary: `${p.name} is now ${status.replace(/_/g, " ").toLowerCase()}`, client_visible: true });
        });
      },

      async addDeliverable(projectId, input) {
        return mutate((s) => {
          s.data.artifacts.unshift({ id: id(), project_id: projectId, type: "deliverable", name: input.name, description: input.description, storage_path: input.file ? `demo/${input.file.name}` : null, status: "FINAL", client_visible: input.share, created_at: new Date().toISOString() });
          addEvent(s, { project_id: projectId, type: "DELIVERABLE_SHARED", summary: `Deliverable: ${input.name}`, client_visible: input.share });
        });
      },
      async postUpdate(projectId, input) {
        return mutate((s) => {
          addEvent(s, { project_id: projectId, type: "UPDATE", summary: input.summary, client_visible: input.share });
        });
      },

      async createTask(projectId, input) {
        return mutate((s) => {
          s.data.tasks.unshift({ id: id(), project_id: projectId, title: input.title, domain: input.domain, risk: input.risk, reversibility: 3, approval_required: input.approval_required, status: "PENDING", description: null, created_at: new Date().toISOString(), started_at: null, completed_at: null });
          addEvent(s, { project_id: projectId, type: "TASK_CREATED", summary: `Task: ${input.title}`, client_visible: false });
        });
      },
      async setTaskStatus(taskId, status) {
        return mutate((s) => {
          const t = s.data.tasks.find((x) => x.id === taskId);
          if (!t) return;
          t.status = status;
          if (status === "RUNNING" && !t.started_at) t.started_at = new Date().toISOString();
          if (status === "COMPLETED") t.completed_at = new Date().toISOString();
          addEvent(s, { project_id: t.project_id, type: "TASK_STATUS", summary: `${t.title}: ${status.replace(/_/g, " ").toLowerCase()}`, client_visible: status === "COMPLETED" });
        });
      },
      async requestApproval(projectId, input) {
        return mutate((s) => {
          s.data.approvals.unshift({ id: id(), project_id: projectId, target_type: "PROJECT", title: input.title, reason: input.reason, recommendation: input.recommendation || null, consequences: input.consequences || null, risk: input.risk, reversibility: input.reversibility, requires_client: input.requires_client, status: "REQUESTED", constraints: null, evidence_request: null, resolution_note: null, resolved_at: null, resolved_by: null, created_at: new Date().toISOString() });
          addEvent(s, { project_id: projectId, type: "APPROVAL_REQUESTED", summary: `Approval requested: ${input.title}`, client_visible: input.requires_client });
        });
      },
      async recordDecision(projectId, input) {
        return mutate((s) => {
          s.data.decisions.unshift({ id: id(), project_id: projectId, question: input.question, options: input.options, recommendation: input.recommendation, status: "WAITING_FOR_HUMAN", confidence: null, risk: null, reversibility: null, rationale: null, selected_option: null, created_at: new Date().toISOString(), resolved_at: null });
          addEvent(s, { project_id: projectId, type: "DECISION_PROPOSED", summary: `Decision raised: ${input.question}`, client_visible: false });
        });
      },
      async addRequirement(projectId, input) {
        return mutate((s) => {
          s.data.requirements.unshift({ id: id(), project_id: projectId, name: input.name, description: input.description, category: "general", required: true, status: "REQUESTED", reason: "", assigned_to_client: input.assigned_to_client, deadline: null, resolved_at: null, response: null, response_file_path: null, created_at: new Date().toISOString() });
          addEvent(s, { project_id: projectId, type: "CONTEXT_REQUESTED", summary: `Requirement requested: ${input.name}`, client_visible: input.assigned_to_client });
        });
      },
      async addEvidence(projectId, input) {
        return mutate((s) => {
          s.data.evidence.unshift({ id: id(), project_id: projectId, approval_id: null, claim: input.claim, source: input.source, source_type: "HUMAN", confidence: input.confidence, created_at: new Date().toISOString() });
        });
      },
      async recordOutcome(projectId, input) {
        return mutate((s) => {
          s.data.outcomes.unshift({ id: id(), project_id: projectId, metric: input.metric, expected_value: input.expected_value, actual_value: input.actual_value, interpretation: null, created_at: new Date().toISOString() });
          addEvent(s, { project_id: projectId, type: "OUTCOME", summary: `Outcome: ${input.metric}`, client_visible: true });
        });
      },
    },
  };
}
