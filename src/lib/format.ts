import type { ApprovalStatus, ArtifactStatus, ContextStatus, DecisionStatus, IntentStatus, PlanStatus, Project, ProjectStatus, RunStatus, ScanStatus, Task, TaskStatus } from "./model";

// Pure presentation helpers, copied from the preview's lib/v4.ts. No data access here.

export const PROJECT_STATUSES: Project["status"][] = ["INTAKE","PROPOSED","ACTIVE","WAITING","DELIVERED","MONITORING","COMPLETED","PAUSED","CANCELLED","ARCHIVED"];
export const TASK_STATUSES: Task["status"][] = ["PENDING","READY","RUNNING","WAITING","BLOCKED","FAILED","COMPLETED","CANCELLED"];

export const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const riskLabel = (n: number | null | undefined) => (n == null ? "Unrated" : n <= 2 ? "Low" : n === 3 ? "Medium" : "High");
export const reversibilityLabel = (n: number | null | undefined) => (n == null ? "Unrated" : n >= 4 ? "High" : n === 3 ? "Medium" : "Low");
/**
 * What a status means to the person reading it, as one of four families, each with its own colour (`.pill.<tone>`):
 * waiting on someone (amber), done or going well (green), refused or broken (a muted red), and information only (slate).
 * Keyed by the statuses themselves, typed from the read model, so a status the API adds fails the typecheck here until it is
 * given a family. There is no second list of statuses: this map is the only place a status is given a colour.
 */
export type Tone = "amber" | "green" | "red" | "slate";
type Family = "waiting" | "done" | "refused" | "info";
type AnyStatus = ProjectStatus | TaskStatus | ApprovalStatus | ArtifactStatus | DecisionStatus | ContextStatus | IntentStatus | PlanStatus | RunStatus | ScanStatus;
const FAMILY: Record<AnyStatus, Family> = {
  // Waiting on a person, or held until something arrives.
  PROPOSED: "waiting", WAITING: "waiting", REQUESTED: "waiting", WAITING_FOR_HUMAN: "waiting", PAUSED: "waiting", BLOCKED: "waiting", MISSING: "waiting",
  PARTIALLY_RECEIVED: "waiting", CLARIFYING: "waiting", SUBMITTED: "waiting", REVISION_REQUESTED: "waiting", PENDING_SCAN: "waiting", PENDING_UPLOAD: "waiting",
  // Done, or moving as it should.
  ACTIVE: "done", DELIVERED: "done", MONITORING: "done", COMPLETED: "done", RUNNING: "done", GRANTED: "done", APPROVED: "done", FINAL: "done", ACCEPTED: "done",
  RECEIVED: "done", VALIDATED: "done", UNDERSTOOD: "done", PLANNED: "done", CLEAN: "done",
  // Refused, failed, or unsafe.
  REJECTED: "refused", FAILED: "refused", INFECTED: "refused",
  // Information: where something is, with nothing asked of anyone.
  INTAKE: "info", CANCELLED: "info", ARCHIVED: "info", PENDING: "info", READY: "info", EXPIRED: "info", DRAFT: "info", SUPERSEDED: "info", DEFERRED: "info",
  ASSUMED: "info", AWAITING_REASONING: "info",
};
const TONE: Record<Family, Tone> = { waiting: "amber", done: "green", refused: "red", info: "slate" };
const isStatus = (s: string): s is AnyStatus => Object.hasOwn(FAMILY, s);
export const statusTone = (s: string): Tone => TONE[isStatus(s) ? FAMILY[s] : "info"];
export const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
export const fmtAgo = (d: string) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};
export const pad = (n: number) => String(n).padStart(2, "0");
