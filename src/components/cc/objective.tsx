"use client";

import { useQuery } from "@tanstack/react-query";
import { useDataSource } from "@/lib/data";
import { fmtDate, statusTone } from "@/lib/format";
import type { PlanVersion, ProjectObjectiveView } from "@/lib/model";

/**
 * A project's goal as a decision its owner made (v4 ADR-0063). v4 keeps the record and says what approving each waiting plan
 * would do to it; these only put that in words. The plan says it before the decision, so approving a plan is knowingly confirming,
 * keeping or changing the goal; the project keeps the goals it replaced.
 */
export function PlanGoal({ view, shown }: { view: ProjectObjectiveView | null; shown: PlanVersion }) {
  const effect = view?.effects.find((e) => e.proposal_id === shown.id)?.effect;
  const now = view?.objective;
  if (!effect) return null;
  return <div className={`plan-goal${effect === "REPLACES" ? " changes" : ""}`} aria-label="The goal">
    <span className="plan-goal-label">{effect === "REPLACES" ? "A NEW GOAL" : "THE GOAL"}</span>
    <p>{shown.plan.objective}</p>
    {effect === "CONFIRMS" && <small>Approving this plan confirms this as the project&apos;s goal. Later changes are weighed against it.</small>}
    {effect === "KEEPS" && <small>The goal stays as confirmed{now?.decided_at ? ` on ${fmtDate(now.decided_at)}` : ""}.</small>}
    {effect === "REPLACES" && <small>This plan changes the project&apos;s goal. The goal now: &ldquo;{now?.statement}&rdquo;. Approving makes the new one the goal; the old one stays on the project&apos;s record.</small>}
  </div>;
}

/** On a project: its goal, whether the owner has confirmed it, and every goal it replaced, newest first. */
export function ProjectGoal({ projectId }: { projectId: string }) {
  const ds = useDataSource();
  const { data } = useQuery({ queryKey: ["objective", projectId], queryFn: async () => (await ds.plans.objective(projectId)).data ?? null });
  const now = data?.objective;
  if (!now) return null;
  return <div className="project-goal" aria-label="The goal">
    <div className="section-label pd-label"><span>THE GOAL</span>{now.version > 1 && <span>VERSION {now.version}</span>}</div>
    <div className="resolved-row"><span>{now.statement}<small>{now.state === "DECIDED_BY_OWNER" ? `Confirmed by the owner on ${fmtDate(now.decided_at)}` : "Proposed. Approving the plan confirms it."}</small></span></div>
    {now.history.map((h) => <div key={h.version} className="resolved-row goal-earlier"><span>{h.statement}<small>Version {h.version}{h.decided_at ? `, confirmed on ${fmtDate(h.decided_at)}` : ""}, then replaced</small></span><span className={`pill ${statusTone("SUPERSEDED")}`}>REPLACED</span></div>)}
  </div>;
}
