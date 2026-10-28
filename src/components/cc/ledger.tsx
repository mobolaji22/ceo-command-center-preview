"use client";

import { useQuery } from "@tanstack/react-query";
import { useDataSource } from "@/lib/data";
import { fmtAgo, fmtDate, label, pad } from "@/lib/format";
import type { DecisionEntry, DelegationView, OwnerData } from "@/lib/model";
import { StandingPermission } from "./standing";

/**
 * The Computer's Decision Ledger and Security/Gov tabs, from the records themselves: every plan decision with who made it, what the
 * agency may do without asking right now, and whether each client's audit chain is intact. Nothing here decides anything; the CEO
 * reads it. A client's records are theirs, so these are only for the agency.
 */
const WORDS: Record<string, string> = { APPROVED: "Approved", REVISION_REQUESTED: "Asked for a change", REJECTED: "Declined" };
const TONE: Record<string, string> = { APPROVED: "green", REVISION_REQUESTED: "amber", REJECTED: "muted" };

const nameOf = (data: OwnerData, projectId: string) => data.projects.find((p) => p.id === projectId)?.name ?? "A project";
const orgName = (data: OwnerData, orgId: string) => data.organizations.find((o) => o.id === orgId)?.name ?? "A client";

/** Every plan decision on every project, newest first. */
export function PlanDecisionLedger({ data }: { data: OwnerData }) {
  const ds = useDataSource();
  const ids = data.projects.map((p) => p.id);
  const q = useQuery({
    queryKey: ["ledger", ...ids],
    queryFn: async () => {
      const rows: Array<{ projectId: string; entry: DecisionEntry }> = [];
      for (const id of ids) for (const entry of (await ds.plans.decisions(id)).data ?? []) rows.push({ projectId: id, entry });
      return rows.sort((a, b) => b.entry.decided_at.localeCompare(a.entry.decided_at));
    },
  });
  const rows = q.data ?? [];
  if (q.isLoading) return <p className="case-none">Loading…</p>;
  return <>
    <div className="section-label"><span>PLAN DECISIONS</span><span>{pad(rows.length)} ON RECORD</span></div>
    {rows.length === 0 ? <p className="case-none">No plan has been decided yet.</p> :
      <div className="dossier-list" aria-label="Plan decisions">{rows.map(({ projectId, entry: e }, i) => <div key={`${e.proposal_id}`} className="dossier-row">
        <span className="row-index">{pad(i + 1)}</span>
        <div><b>{nameOf(data, projectId)}: version {e.version}</b>
          <small>{e.decided_by_role === "CEO" ? (e.on_behalf ? "The CEO, on the client's behalf" : "The CEO") : "The client's owner"} · {fmtDate(e.decided_at)} ({fmtAgo(e.decided_at)}){e.note ? ` · “${e.note}”` : ""}</small></div>
        <span className={`pill ${TONE[e.decision] ?? "muted"}`}>{(WORDS[e.decision] ?? label(e.decision)).toUpperCase()}</span></div>)}</div>}
  </>;
}

const inForce = (d: DelegationView, now: number) => !d.revoked_at && (!d.expires_at || new Date(d.expires_at).getTime() > now);

/** What the agency may do without asking, and whether each client's record of decisions is intact. */
export function GovernancePanel({ data }: { data: OwnerData }) {
  const ds = useDataSource();
  const ids = data.projects.map((p) => p.id);
  const orgs = data.organizations;
  const delegations = useQuery({
    queryKey: ["governance-delegations", ...ids],
    queryFn: async () => {
      const seen = new Map<string, DelegationView>();
      for (const id of ids) for (const d of (await ds.plans.delegations(id)).data ?? []) seen.set(d.id, d);
      for (const o of orgs) for (const d of (await ds.standing.list(o.id)).data ?? []) seen.set(d.id, d);
      // What is in force is decided when the records are read, not when the page is drawn.
      const now = Date.now();
      return [...seen.values()].filter((d) => inForce(d, now));
    },
  });
  const chains = useQuery({
    queryKey: ["governance-chains", ...orgs.map((o) => o.id)],
    meta: { static: true },
    queryFn: async () => Promise.all(orgs.map(async (o) => ({ org: o, chain: (await ds.audit.chain(o.id)).data }))),
  });
  const live = delegations.data ?? [];
  return <>
    <div className="section-label"><span>WHAT WE MAY DO WITHOUT ASKING</span><span>{pad(live.length)} IN FORCE</span></div>
    {delegations.isLoading ? <p className="case-none">Loading…</p> : live.length === 0 ? <p className="case-none">Nothing is delegated: every step asks first.</p> :
      <div className="dossier-list" aria-label="Delegations in force">{live.map((d, i) => <div key={d.id} className="dossier-row">
        <span className="row-index">{pad(i + 1)}</span>
        <div><b>{d.basis === "STANDING_POLICY" ? `${orgName(data, d.organization_id)}${d.project_id ? `: ${nameOf(data, d.project_id)}` : ""}: standing permission` : `${d.project_id ? nameOf(data, d.project_id) : orgName(data, d.organization_id)}: approved plan`}</b>
          <small>{d.scopes.length} kind{d.scopes.length === 1 ? "" : "s"} of work · never above risk {d.max_risk}{d.expires_at ? ` · until ${fmtDate(d.expires_at)}` : ""}{d.on_behalf ? " · granted on the client's behalf" : ""}</small></div>
        <span className="pill green">IN FORCE</span></div>)}</div>}

    <div className="section-label"><span>STANDING PERMISSIONS</span><span>BY CLIENT</span></div>
    <p className="case-none">What the agency may do for a client without asking each time, for a limited time. For a client it is their decision: you can set one only under the permission their owner gave you. It never covers anything above risk 3, hard to undo, or that publishes, sends, deletes or pays, and it adds no spending.</p>
    <div className="dossier-list" aria-label="Standing permissions by client">{orgs.map((o) => <div key={o.id} className="standing-org"><b>{o.name}</b>
      <StandingPermission organizationId={o.id} projectIds={data.projects.filter((p) => p.organization_id === o.id).map((p) => p.id)} actingAs="ceo" orgName={o.name} /></div>)}</div>

    <div className="section-label"><span>AUDIT CHAINS</span><span>EACH CLIENT'S OWN</span></div>
    {chains.isLoading ? <p className="case-none">Loading…</p> : <div className="dossier-list" aria-label="Audit chains">{(chains.data ?? []).filter((c) => c.chain).map(({ org, chain }, i) => {
      const last = chain!.entries.at(-1);
      return <div key={org.id} className="dossier-row">
        <span className="row-index">{pad(i + 1)}</span>
        <div><b>{org.name}</b><small>{chain!.entries.length} entr{chain!.entries.length === 1 ? "y" : "ies"} sealed{last ? ` · last: ${label(last.kind.replace(/\./g, " "))}, ${fmtAgo(last.created_at)}` : ""}{!chain!.ok ? ` · broken at entry ${chain!.broken_at}: ${chain!.reason}` : ""}</small></div>
        <span className={`pill ${chain!.ok ? "green" : "amber"}`}>{chain!.ok ? "INTACT" : "BROKEN"}</span></div>;
    })}</div>}
  </>;
}
