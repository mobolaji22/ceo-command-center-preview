"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useDataSource } from "@/lib/data";
import type { DecisionEntry, DelegationView, PlanChange, PlanVersion } from "@/lib/model";
import { fmtAgo, label } from "@/lib/format";

const usd = (n: number) => `$${n.toFixed(2)}`;
const STATUS_WORDS: Record<string, string> = {
  SUBMITTED: "Awaiting a decision", APPROVED: "Approved", REVISION_REQUESTED: "Change requested", REJECTED: "Declined", SUPERSEDED: "Replaced", DRAFT: "Draft",
};
const tone = (s: string) => (s === "APPROVED" ? "green" : s === "SUBMITTED" ? "amber" : "muted");
const DECISION_WORDS: Record<string, string> = { APPROVED: "Approved", REVISION_REQUESTED: "Asked for a change", REJECTED: "Declined" };

/**
 * The plan for a project, as a document a person can read and decide on (P3). It shows the current version with its cost and
 * what it assumes, what changed since the version before, what has been decided so far, and what the approved plan lets the
 * agency do without asking again. The API decides who may do what; this only hides actions that would be refused.
 */
export function PlanPanel({ projectId, organizationId, onChanged }: { projectId: string; organizationId: string; onChanged: () => void }) {
  const ds = useDataSource();
  const auth = useAuth();
  const [versions, setVersions] = useState<PlanVersion[] | null>(null);
  const [history, setHistory] = useState<DecisionEntry[]>([]);
  const [delegations, setDelegations] = useState<DelegationView[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [changeFor, setChangeFor] = useState<{ id: string; change: PlanChange } | null>(null);
  const [mode, setMode] = useState<null | "approve" | "change" | "decline" | "revoke">(null);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mayState, setMayState] = useState<{ id: string; ok: boolean } | null>(null);

  const isCEO = auth.isOwner;
  const isClientOwner = auth.user?.memberships.some((m) => m.organizationId === organizationId && m.role === "CLIENT_OWNER") ?? false;

  const fetchAll = useCallback(() => Promise.all([ds.plans.list(projectId), ds.plans.decisions(projectId), ds.plans.delegations(projectId)]), [ds, projectId]);
  const apply = useCallback(([v, h, d]: Awaited<ReturnType<typeof fetchAll>>) => { setVersions(v.data ?? []); setHistory(h.data ?? []); setDelegations(d.data ?? []); }, []);
  const load = async () => apply(await fetchAll());
  useEffect(() => {
    let live = true;
    void fetchAll().then((r) => { if (live) apply(r); });
    return () => { live = false; };
  }, [fetchAll, apply]);

  const latest = versions && versions.length ? versions[versions.length - 1]! : null;
  const shown = versions?.find((v) => v.version === (picked ?? latest?.version)) ?? latest;
  const isCurrent = shown !== null && latest !== null && shown.id === latest.id;
  const onBehalf = isCEO && shown?.decision_owner === "CLIENT_OWNER";

  useEffect(() => {
    if (!latest || !onBehalf || latest.status !== "SUBMITTED") return;
    let live = true;
    void ds.plans.mayDecideForClient(latest).then((ok) => { if (live) setMayState({ id: latest.id, ok }); });
    return () => { live = false; };
  }, [ds, latest, onBehalf]);
  const mayForClient = mayState !== null && mayState.id === latest?.id && mayState.ok;
  const change = changeFor && changeFor.id === shown?.id ? changeFor.change : null;

  if (!versions || !shown || !latest) return null;

  const canDecide = isCurrent && shown.status === "SUBMITTED" && (shown.decision_owner === "CEO" ? isCEO : isClientOwner || (isCEO && mayForClient));
  const titleOf = (id: string) => shown.plan.tasks.find((t) => t.id === id)?.title ?? id;
  const p = shown.plan;

  const decide = async (action: "APPROVE" | "REQUEST_REVISION" | "REJECT", done: (next: number | null) => string) => {
    setBusy(true); setMsg(null);
    const r = await ds.plans.decide(shown.id, { action, ...(text.trim() ? { note: text.trim() } : {}) });
    setBusy(false);
    if (r.error || !r.data) { setMsg(r.error?.message ?? "That didn't go through."); return; }
    setMsg(done(r.data.nextVersion)); setMode(null); setText(""); setPicked(null);
    await load(); onChanged();
  };
  const showChange = async () => {
    if (change) { setChangeFor(null); return; }
    const r = await ds.plans.changes(shown.id);
    if (r.error || !r.data) { setMsg(r.error?.message ?? "Couldn't load that."); return; }
    setChangeFor({ id: shown.id, change: r.data });
  };
  const revoke = async (d: DelegationView) => {
    setBusy(true);
    const r = await ds.plans.revokeDelegation(d.id, text.trim());
    setBusy(false);
    if (r.error) { setMsg(r.error.message); return; }
    setMsg("Done. From now on every step asks first."); setMode(null); setText(""); await load(); onChanged();
  };
  const who = (h: DecisionEntry) => {
    if (h.on_behalf) return isCEO ? "You, on the client's behalf" : "The agency's CEO, on your behalf";
    return h.decided_by_role === "CEO" ? (isCEO ? "You" : "The agency's CEO") : isCEO ? "The client's owner" : "You";
  };
  const live = delegations.filter((d) => !d.revoked_at);

  return <section className="plan" aria-label="Plan">
    <div className="section-label"><span>THE PLAN</span>
      <span className="plan-versions" role="tablist" aria-label="Versions">{versions.map((v) => <button key={v.id} role="tab" aria-selected={v.id === shown.id} className={v.id === shown.id ? "active" : ""} onClick={() => { setPicked(v.version); setMode(null); }}>v{v.version}</button>)}</span></div>
    <div className="resolved-row"><span>Version {shown.version}{shown.rationale && <small>{shown.rationale}</small>}</span><span className={`pill ${tone(shown.status)}`}>{(STATUS_WORDS[shown.status] ?? label(shown.status)).toUpperCase()}</span></div>
    {msg && <p className="mmsg" role="status">{msg}</p>}

    <div className="plan-doc">
      <h4>What we will do</h4><p>{p.objective}</p>
      <h4>Included</h4><ul>{p.scope_in.map((x) => <li key={x}>{x}</li>)}</ul>
      {p.scope_out.length > 0 && <><h4>Not included</h4><ul>{p.scope_out.map((x) => <li key={x}>{x}</li>)}</ul></>}
      <h4>What you get</h4><ul>{p.deliverables.map((d) => <li key={d.id}>{d.name}</li>)}</ul>
      <h4>How we will know it worked</h4><ul>{p.success_metrics.map((m) => <li key={m.id}>{m.target}<small>Measured by: {m.measurement}. Over: {m.window}.</small></li>)}</ul>
      <h4>The work</h4><ol className="plan-tasks">{p.tasks.map((t) => <li key={t.id}>{t.title}<small>{label(t.domain)} · {t.rigor} effort{t.depends_on.length ? ` · after ${t.depends_on.map(titleOf).join(", ")}` : ""}</small></li>)}</ol>
      <h4>What it may cost</h4>
      <p className="plan-cost" aria-label="Estimated cost"><b>{usd(p.budget.low_usd)} to {usd(p.budget.high_usd)}</b><small>An estimate by effort level, not a quote ({Math.round(p.budget.confidence * 100)}% sure).</small></p>
      {p.risks.length > 0 && <><h4>What could go wrong</h4><ul>{p.risks.map((r) => <li key={r.risk}>{r.risk}<small>{r.mitigation}</small></li>)}</ul></>}
      {p.assumptions.length > 0 && <><h4>What we assumed</h4><ul>{p.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></>}
      {p.open_context_needs.length > 0 && <><h4>What we still need from you</h4><ul>{p.open_context_needs.map((a) => <li key={a}>{a}</li>)}</ul></>}
      {p.decision_points.length > 0 && <><h4>Where we will ask you</h4><ul>{p.decision_points.map((d) => <li key={d.description}>{d.description}</li>)}</ul></>}
    </div>

    {shown.version > 1 && <div className="plan-change">
      <Button variant="ghost" onClick={showChange}>{change ? "Hide what changed" : `What changed since version ${shown.version - 1}`}</Button>
      {change && <div aria-label="What changed">{change.unchanged ? <p>Nothing changed.</p> : <ul>{change.summary.map((s) => <li key={s}>{s}</li>)}</ul>}</div>}
    </div>}

    {onBehalf && isCurrent && shown.status === "SUBMITTED" && <p className="mmsg"><ShieldCheck size={14} /> This is the client&apos;s decision. {mayForClient ? "Their owner has given you permission to decide it; they will see that you did." : "You can make it only if their owner gives you permission."}</p>}
    {canDecide && <div className="plan-actions" aria-label="Decide">
      {mode === null && <>
        <Button className="approve-btn" onClick={() => setMode("approve")}><Check size={15} /> Approve{onBehalf ? " for the client" : ""}</Button>
        <Button variant="outline" onClick={() => setMode("change")}>Ask for a change</Button>
        <Button variant="outline" className="reject-btn" onClick={() => setMode("decline")}>Decline</Button>
      </>}
      {mode === "approve" && <div className="plan-confirm"><p>{onBehalf ? "You are deciding for the client. They will see that you did, and it is recorded. " : ""}Approving lets us do this work without asking again, within these limits: nothing above medium risk, nothing hard to undo, nothing outside the list above. You can take that back at any time.</p>
        <Button className="approve-btn" disabled={busy} onClick={() => decide("APPROVE", () => "Approved. The work can begin.")}>Confirm approval</Button> <Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button></div>}
      {mode === "change" && <div className="plan-confirm"><label htmlFor="plan-change-text">WHAT WOULD YOU LIKE CHANGED?</label>
        <textarea id="plan-change-text" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="For example: make it cheaper, or drop the blog posts." />
        <Button className="approve-btn" disabled={busy || !text.trim()} onClick={() => decide("REQUEST_REVISION", (n) => (n ? `Thank you. Version ${n} is ready for you.` : "Thank you. We will send a new version."))}>Send</Button> <Button variant="ghost" onClick={() => { setMode(null); setText(""); }}>Cancel</Button></div>}
      {mode === "decline" && <div className="plan-confirm"><label htmlFor="plan-decline-text">WHY? (OPTIONAL)</label>
        <textarea id="plan-decline-text" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
        <Button className="reject-btn" variant="outline" disabled={busy} onClick={() => decide("REJECT", () => "Declined. Nothing will start.")}>Decline this plan</Button> <Button variant="ghost" onClick={() => { setMode(null); setText(""); }}>Cancel</Button></div>}
    </div>}

    {history.length > 0 && <div className="plan-history"><div className="section-label"><span>DECISIONS</span><span>{history.length}</span></div>
      {history.map((h) => <div key={h.proposal_id} className="resolved-row"><span>Version {h.version}: {DECISION_WORDS[h.decision]}<small>{who(h)} · {fmtAgo(h.decided_at)}{h.note ? ` · “${h.note}”` : ""}</small></span></div>)}</div>}

    {delegations.length > 0 && <div className="plan-delegation" aria-label="What we may do without asking again"><div className="section-label"><span>WHAT WE MAY DO WITHOUT ASKING AGAIN</span></div>
      {delegations.map((d) => <div key={d.id} className="resolved-row"><span>{d.revoked_at ? "Taken back" : "In force"}: approved plan, version {versions.find((v) => v.id === d.proposal_id)?.version ?? "?"}
        <small>{d.scopes.map((s) => { const [dom, cap] = s.split(":"); return `${label(dom ?? "")}: ${cap}`; }).join(" · ")}</small>
        <small>Never above risk {d.max_risk} or hard to undo; those, and anything not listed, come to you first.{d.budget_max_usd ? ` Estimated spend up to ${usd(d.budget_max_usd)}.` : ""}</small>
        {d.revoked_at && <small>Taken back {fmtAgo(d.revoked_at)}{d.revoked_reason ? `: “${d.revoked_reason}”` : ""}. Every step now asks first.</small>}</span>
        {!d.revoked_at && (isClientOwner || isCEO) && (mode === "revoke"
          ? <span className="plan-confirm"><input aria-label="Why (optional)" placeholder="Why? (optional)" value={text} onChange={(e) => setText(e.target.value)} /><Button className="reject-btn" variant="outline" disabled={busy} onClick={() => revoke(d)}>Confirm: take it back</Button> <Button variant="ghost" onClick={() => { setMode(null); setText(""); }}>Cancel</Button></span>
          : <Button variant="outline" className="reject-btn" onClick={() => setMode("revoke")}>Take this back</Button>)}</div>)}
      {live.length === 0 && <p className="mmsg">Nothing is delegated now: every step asks first.</p>}</div>}
  </section>;
}
