import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];
export type Project = T["projects"]["Row"];
export type Task = T["tasks"]["Row"];
export type Decision = T["decisions"]["Row"];
export type Approval = T["approvals"]["Row"];
export type Evidence = T["evidence"]["Row"];
export type Artifact = T["artifacts"]["Row"];
export type Requirement = T["context_requirements"]["Row"];
export type Outcome = T["outcomes"]["Row"];
export type V4Event = T["events"]["Row"];
export type Directive = T["directives"]["Row"];
export type Organization = T["organizations"]["Row"];
export type Profile = T["profiles"]["Row"];
export type ProjectClient = T["project_clients"]["Row"];

export const PROJECT_STATUSES: Project["status"][] = ["DORMANT","INTENT","DISCOVERY","DEFINED","PLANNED","IN_PROGRESS","REVIEW","WAITING_FOR_HUMAN","BLOCKED","APPROVAL","EXECUTION","VALIDATION","COMPLETED","MONITORING","PAUSED","CANCELLED","SUPERSEDED","ARCHIVED"];
export const TASK_STATUSES: Task["status"][] = ["PENDING","READY","RUNNING","WAITING","WAITING_FOR_HUMAN","BLOCKED","FAILED","COMPLETED","CANCELLED"];

export const ownerKey = ["owner-data"] as const;

function must<D>(r: { data: D | null; error: { message: string } | null }): D {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as D;
}

export async function fetchOwnerData() {
  const [projects, tasks, decisions, approvals, evidence, artifacts, requirements, outcomes, events, directives, organizations, profiles, roles, links] = await Promise.all([
    supabase.from("projects").select("*").order("priority", { ascending: false }),
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("decisions").select("*").order("created_at", { ascending: false }),
    supabase.from("approvals").select("*").order("created_at", { ascending: false }),
    supabase.from("evidence").select("*").order("created_at", { ascending: false }),
    supabase.from("artifacts").select("*").order("created_at", { ascending: false }),
    supabase.from("context_requirements").select("*").order("created_at", { ascending: false }),
    supabase.from("outcomes").select("*").order("created_at", { ascending: false }),
    supabase.from("events").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("directives").select("*").order("created_at", { ascending: false }),
    supabase.from("organizations").select("*").order("name"),
    supabase.from("profiles").select("*"),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("project_clients").select("*"),
  ]);
  const roleRows = must(roles) as { user_id: string; role: string }[];
  const clientIds = new Set(roleRows.filter((r) => r.role === "client").map((r) => r.user_id));
  return {
    projects: must(projects) as Project[],
    tasks: must(tasks) as Task[],
    decisions: must(decisions) as Decision[],
    approvals: must(approvals) as Approval[],
    evidence: must(evidence) as Evidence[],
    artifacts: must(artifacts) as Artifact[],
    requirements: must(requirements) as Requirement[],
    outcomes: must(outcomes) as Outcome[],
    events: must(events) as V4Event[],
    directives: must(directives) as Directive[],
    organizations: must(organizations) as Organization[],
    clients: (must(profiles) as Profile[]).filter((p) => clientIds.has(p.id)),
    links: must(links) as ProjectClient[],
  };
}
export type OwnerData = Awaited<ReturnType<typeof fetchOwnerData>>;

export async function logEvent(e: { project_id?: string | null; type: string; summary: string; client_visible?: boolean }) {
  const { data } = await supabase.auth.getUser();
  await supabase.from("events").insert({ ...e, actor_id: data.user?.id ?? null });
}

export const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const riskLabel = (n: number | null | undefined) => (n == null ? "Unrated" : n <= 2 ? "Low" : n === 3 ? "Medium" : "High");
export const reversibilityLabel = (n: number | null | undefined) => (n == null ? "Unrated" : n >= 4 ? "High" : n === 3 ? "Medium" : "Low");
export const statusTone = (s: string) =>
  ["COMPLETED","GRANTED","ACCEPTED","RECEIVED","VALIDATED","FINAL","APPROVED","MONITORING","IN_PROGRESS","EXECUTION","RUNNING"].includes(s) ? "green"
  : ["BLOCKED","FAILED","REJECTED","WAITING_FOR_HUMAN","REQUESTED","APPROVAL","REVIEW","PROPOSED","MISSING"].includes(s) ? "amber" : "muted";
export const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
export const fmtAgo = (d: string) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};
export const pad = (n: number) => String(n).padStart(2, "0");

export async function signedUrl(path: string) {
  const { data, error } = await supabase.storage.from("project-files").createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
