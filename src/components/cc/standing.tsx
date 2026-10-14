"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import { fmtAgo, fmtDate, label } from "@/lib/format";
import type { DelegationView } from "@/lib/model";
import { useStepUp } from "./step-up";

/**
 * Standing permission: what the agency may do for this client without asking each time, for a limited time. The owner picks from the
 * kinds of work their plans have named, and for how long. It never covers anything above risk 3, anything hard to undo, or the
 * consequential actions (publishing, sending, deleting, paying, deploying), and it adds no spending of its own; the server holds the
 * same limits, so this only keeps from offering what would be refused. It can be taken back at any time.
 */
const ALWAYS_ASKS = new Set(["publish", "send", "delete", "pay", "transact", "execute-external", "execute-terminal", "deploy-production", "outreach-campaign"]);
const DAYS = [7, 30, 90];
const kindWords = (scope: string) => { const [dom, cap] = scope.split(":"); return `${label(dom ?? "")}: ${(cap ?? "").replace(/[-_.]/g, " ")}`; };

export function StandingPermission({ organizationId, projectIds, actingAs = "owner", orgName }: { organizationId: string; projectIds: string[]; actingAs?: "owner" | "ceo"; orgName?: string }) {
  const ceo = actingAs === "ceo";
  const ds = useDataSource();
  const qc = useQueryClient();
  const { guard, panel } = useStepUp();
  const current = useQuery({ queryKey: ["standing", organizationId], queryFn: async () => { const r = await ds.standing.list(organizationId); if (r.error) throw new Error(r.error.message); return r.data!; } });
  const kinds = useQuery({
    queryKey: ["standing-kinds", ...projectIds],
    queryFn: async () => {
      const found = new Set<string>();
      for (const id of projectIds) {
        const r = await ds.plans.list(id);
        for (const v of r.data ?? []) for (const t of v.plan.tasks) found.add(`${t.domain}:${t.capability}`.toLowerCase());
      }
      return [...found].filter((s) => !ALWAYS_ASKS.has(s.slice(s.indexOf(":") + 1))).sort();
    },
  });
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [why, setWhy] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);

  // The moment this screen opened; a grant that lapses while it is open shows on the next refresh.
  const [now] = useState(() => Date.now());
  const rows: DelegationView[] = current.data ?? [];
  const inForce = rows.find((d) => !d.revoked_at && (!d.expires_at || new Date(d.expires_at).getTime() > now));
  // The governance tab lists what is in force and each client's audit chain from the same records, so they look again too.
  const refresh = () => Promise.all([["standing", organizationId], ["governance-delegations"], ["governance-chains"]].map((queryKey) => qc.invalidateQueries({ queryKey })));

  const grant = async () => {
    setBusy(true); setMsg(null);
    await guard(() => ds.standing.grant({ organizationId, scopes: picked, validDays: days }), async (r) => {
      setBusy(false);
      if (r.error) { setMsg(r.error.message); return; }
      setOpen(false); setPicked([]); setMsg(ceo ? "Done. These kinds of work will not be asked about until it ends." : "Done. The agency will not ask about these kinds of work until it ends.");
      await refresh();
    });
    setBusy(false);
  };
  const revoke = async (d: DelegationView) => {
    setBusy(true);
    const r = await ds.plans.revokeDelegation(d.id, why.trim());
    setBusy(false);
    if (r.error) { setMsg(r.error.message); return; }
    setRevoking(null); setWhy(""); setMsg("Taken back. Work the plan does not name asks first again.");
    await refresh();
  };

  return <section className="standing" aria-label={ceo ? `Standing permission for ${orgName ?? "this client"}` : "Standing permission"}>
    {inForce
      ? <div className="resolved-row"><span>In force, until {fmtDate(inForce.expires_at)}
          <small>{inForce.scopes.map(kindWords).join(" · ")}</small>
          <small>Never above risk {inForce.max_risk} or hard to undo, and nothing that publishes, sends, deletes or pays. It adds no spending of its own.</small>
          {inForce.on_behalf && <small>{ceo ? "Granted by you, on the client's behalf, under the permission they gave." : "Granted for you by the agency's CEO, under the permission you gave."}</small>}</span>
          {revoking === inForce.id
            ? <span className="plan-confirm"><input aria-label="Why (optional)" placeholder="Why? (optional)" value={why} onChange={(e) => setWhy(e.target.value)} />
                <Button className="reject-btn" variant="outline" disabled={busy} onClick={() => revoke(inForce)}>Confirm: take it back</Button> <Button variant="ghost" onClick={() => setRevoking(null)}>Cancel</Button></span>
            : <Button variant="outline" className="reject-btn" onClick={() => setRevoking(inForce.id)}>Take this back</Button>}</div>
      : <p className="case-none">{ceo ? "The agency asks about any kind of work a plan does not name." : "The agency asks you about any kind of work a plan does not name."}</p>}
    {rows.filter((d) => d.revoked_at).slice(0, 2).map((d) => <small key={d.id} className="case-none">Taken back {fmtAgo(d.revoked_at!)}{d.revoked_reason ? `: “${d.revoked_reason}”` : ""}.</small>)}
    {msg && <p className="mmsg" role="status">{msg}</p>}
    {!open
      ? <Button variant="outline" onClick={() => { setOpen(true); setMsg(null); }}>{inForce ? "Replace it" : "Allow without asking"}</Button>
      : <div className="plan-confirm">
          <fieldset><legend>Which kinds of work may we do without asking?</legend>
            {(kinds.data ?? []).length === 0 && <p className="case-none">Kinds of work appear here once a plan names them.</p>}
            {(kinds.data ?? []).map((k) => <label key={k} className="inline-check"><input type="checkbox" checked={picked.includes(k)} onChange={(e) => setPicked(e.target.checked ? [...picked, k] : picked.filter((x) => x !== k))} /> {kindWords(k)}</label>)}</fieldset>
          <label>For how long<select aria-label="For how long" value={days} onChange={(e) => setDays(Number(e.target.value))}>{DAYS.map((d) => <option key={d} value={d}>{d} days</option>)}</select></label>
          <small className="plan-confirm-note">For safety we will ask you for a six-digit code, which we email to you.{ceo ? " For a client this is their decision: it goes through only under the permission their owner gave you." : ""} It can be taken back at any time.</small>
          <Button className="approve-btn" disabled={busy || picked.length === 0} onClick={grant}>Allow these without asking</Button> <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          {panel}
        </div>}
  </section>;
}
