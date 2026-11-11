"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import type { LedgerDecision } from "@/lib/model";
import { fmtAgo, label } from "@/lib/format";

/** The kinds of decision that are the owner's alone, in words. */
const OWNER_ONLY: Record<string, string> = { RIGHTS: "rights", MONEY: "money", PUBLIC_CLAIM: "a public claim", LEGAL_DUTY: "a legal duty", COMMITMENT: "a commitment" };

/**
 * What a project is still waiting on its owner to decide (v4 ADR-0068). Approving the plan decides none of these: each is settled on
 * its own. Confirming the recommendation lets the work that waited go on; choosing otherwise is recorded, and that work waits for a
 * revised plan; "later" keeps it open. Something the agency is to find out is the agency's to record. v4 decides who may answer;
 * this hides the buttons only from someone it would refuse.
 */
export function OpenDecisions({ projectId, mayAnswer, isAgency, onChanged }: { projectId: string; mayAnswer: boolean; isAgency: boolean; onChanged?: () => void }) {
  const ds = useDataSource();
  const [rows, setRows] = useState<LedgerDecision[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => ds.plans.ledger(projectId), [ds, projectId]);
  useEffect(() => {
    let live = true;
    void load().then((r) => { if (live) setRows(r.data ?? []); });
    return () => { live = false; };
  }, [load]);
  if (!rows || rows.length === 0) return null;
  const open = rows.filter((d) => d.state === "OPEN" || d.state === "STALE");
  const closed = rows.filter((d) => !open.includes(d));

  const answer = async (d: LedgerDecision, body: { optionId: string } | { defer: true }) => {
    setBusy(d.id); setMsg(null);
    const r = await ds.plans.resolveDecision(d.id, body);
    setBusy(null);
    if (r.error || !r.data) { setMsg(r.error?.message ?? "That didn't go through."); return; }
    setMsg(r.data.resolution === "ACCEPTED" ? "Confirmed. The work that waited for it can go on." : r.data.resolution === "REJECTED" ? "Recorded. The work planned on the other answer waits for a revised plan." : "Kept open. We will not ask it again until you come back to it.");
    setRows((await load()).data ?? []);
    onChanged?.();
  };
  const canSettle = (d: LedgerDecision) => (d.disposition === "DISCOVER" ? isAgency : mayAnswer);

  return <div className="plan-doc open-decisions" aria-label="Still to decide">
    {open.length > 0 && <><h4>Still to decide</h4>
      <p className="mmsg">Approving the plan does not decide these. Only the work that depends on each one waits for it.</p>
      <ul>{open.map((d) => <li key={d.id}>
        {d.question}
        <small>
          {d.recommendation ? `We recommend: ${d.recommendation.label}${d.recommendation.why ? `. ${d.recommendation.why}` : ""}` : "We have no recommendation yet."}
          {d.authority ? ` · This is yours alone to decide (${OWNER_ONLY[d.authority] ?? label(d.authority)}).` : ""}
          {d.disposition === "DISCOVER" ? " · We are finding this out." : ""}
          {d.holds.length ? ` · Waiting on it: ${d.holds.map(label).join(", ")}` : ""}
          {d.resolution === "DEFERRED" ? " · You chose to decide this later." : ""}
        </small>
        {canSettle(d) && <div className="plan-actions">
          {d.options.map((o) => <Button key={o.id} variant={d.recommendation?.option_id === o.id ? "default" : "ghost"} disabled={busy !== null} onClick={() => void answer(d, { optionId: o.id })}>{d.recommendation?.option_id === o.id ? `Confirm: ${o.label}` : o.label}</Button>)}
          {d.disposition !== "DISCOVER" && d.resolution !== "DEFERRED" && <Button variant="ghost" disabled={busy !== null} onClick={() => void answer(d, { defer: true })}>Decide later</Button>}
        </div>}
      </li>)}</ul></>}
    {msg && <p className="mmsg" role="status">{msg}</p>}
    {closed.length > 0 && <><h4>Decided</h4><ul>{closed.map((d) => <li key={d.id}>{d.question}<small>{d.selected_option?.label ?? "Settled"}{d.resolution === "REJECTED" ? " (not what we recommended: the plan is revised to it)" : ""}{d.resolved_at ? ` · ${fmtAgo(d.resolved_at)}` : ""}</small></li>)}</ul></>}
  </div>;
}
