"use client";

import type { ReactNode } from "react";
import type { ClientPlanView, UsdRange } from "@/lib/model";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const range = (r: UsdRange) => (r.low === r.high ? money(r.low) : `${money(r.low)} to ${money(r.high)}`);

/**
 * The plan as a client reads it (P6.20): what we will do, what it costs and when, then the decision, then what they get, what we
 * need from them, what we assumed and the decisions still to come. Everything else is folded under "More detail". It renders
 * v4's client view as it is: the ordering and what is left out are decided there (INV-27).
 */
export function ClientPlanDoc({ view, actions }: { view: ClientPlanView; actions: ReactNode }) {
  const { summary } = view;
  const anyDue = view.phases.some((p) => p.deliverables.some((d) => d.due));
  return <div className="cv cv-plan">
    <div className="cv-summary" aria-label="Summary">
      <p className="cv-lead">{summary.objective}</p>
      <div className="cv-facts">
        <div className="cv-fact" aria-label="Price">
          <span className="cv-k">Price</span>
          {summary.price
            ? <><b className="cv-total">{range(summary.price.total)}</b>
              <span className="cv-sub">Project {range(summary.price.project_fee)} · Agency fee {summary.price.agency_fee_pct}%: {range(summary.price.agency_fee)}{summary.price.pass_through.map((x) => ` · ${x.item}: ${range(x)}`).join("")}</span>
              <span className="cv-sub">{summary.price_note}</span></>
            : <b className="cv-total cv-muted">{summary.price_note}</b>}
        </div>
        {summary.milestones.length > 0 && <div className="cv-fact" aria-label="When">
          <span className="cv-k">When</span>
          <ul className="cv-dates">{summary.milestones.map((m) => <li key={m.name}><b>{m.target ?? "To be scheduled"}</b><span>{m.name}</span></li>)}</ul>
        </div>}
      </div>
      {actions}
    </div>

    <h4>What you get</h4>
    {view.phases.map((p) => <div key={p.phase ?? 0} className="cv-phase">
      {p.phase !== null && <span className="cv-k">Phase {p.phase}</span>}
      <ul>{p.deliverables.map((d) => <li key={d.name}>{d.name}{anyDue && d.due && <span className="cv-sub"> · {d.due}</span>}</li>)}</ul>
    </div>)}

    {(view.needs.required.length > 0 || view.needs.optional.length > 0) && <>
      <h4>What we need from you</h4>
      <ul>{view.needs.required.map((n) => <li key={n.name}>{n.name}{n.why && <span className="cv-sub"> · {n.why}</span>}</li>)}</ul>
      {view.needs.optional.length > 0 && <details className="cv-more"><summary>Helpful if you have them ({view.needs.optional.length})</summary>
        <ul>{view.needs.optional.map((n) => <li key={n.name}>{n.name}{n.why && <span className="cv-sub"> · {n.why}</span>}</li>)}</ul></details>}
    </>}

    {view.assumed.length > 0 && <><h4>What we assumed</h4><ul>{view.assumed.map((a) => <li key={a}>{a}</li>)}</ul>
      <p className="cv-sub">If any of this is wrong, ask for a change and say which.</p></>}

    {view.decisions.length > 0 && <><h4>Decisions we will bring to you</h4>
      <ul className="cv-decisions">{view.decisions.map((d) => <li key={d.description}>{d.description}<span className="cv-who">{d.decided_by === "YOU" ? "You decide" : "You, or the agency for you"}</span></li>)}</ul></>}

    <details className="cv-more"><summary>More detail</summary>
      <h5>Included</h5><ul>{view.more.included.map((x) => <li key={x}>{x}</li>)}</ul>
      {view.more.not_included.length > 0 && <><h5>Not included</h5><ul>{view.more.not_included.map((x) => <li key={x}>{x}</li>)}</ul></>}
      {view.more.measures.length > 0 && <><h5>How we will know it worked</h5><ul>{view.more.measures.map((m) => <li key={m.target}>{m.target}<span className="cv-sub"> · {m.how} · {m.window}</span></li>)}</ul></>}
      {view.more.risks.length > 0 && <><h5>What could go wrong, and what we do about it</h5><ul>{view.more.risks.map((r) => <li key={r.risk}>{r.risk}<span className="cv-sub"> · {r.mitigation}</span></li>)}</ul></>}
    </details>
  </div>;
}
