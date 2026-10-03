import type { Project, Task } from "./model";

// Pure presentation helpers, copied from the preview's lib/v4.ts. No data access here.

export const PROJECT_STATUSES: Project["status"][] = ["DORMANT","INTENT","DISCOVERY","DEFINED","PLANNED","IN_PROGRESS","REVIEW","WAITING_FOR_HUMAN","BLOCKED","APPROVAL","EXECUTION","VALIDATION","COMPLETED","MONITORING","PAUSED","CANCELLED","SUPERSEDED","ARCHIVED"];
export const TASK_STATUSES: Task["status"][] = ["PENDING","READY","RUNNING","WAITING","WAITING_FOR_HUMAN","BLOCKED","FAILED","COMPLETED","CANCELLED"];

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
