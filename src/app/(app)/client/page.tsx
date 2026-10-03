"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/cc/views";
import { useAuth } from "@/lib/auth";
import { useDataSource } from "@/lib/data";
import { fmtAgo, fmtDate, label, statusTone } from "@/lib/format";
import { Library } from "@/components/cc/library";

/**
 * Client Center (shell). A client sees only their own organization's projects and what was shared with
 * them. The preview only planned this screen; this is a faithful minimal version built on the same
 * visual classes. It grows with CC-1/CC-2 (comments, requirement responses, uploads, handoff).
 */
export default function ClientCenter() {
  const auth = useAuth();
  const ds = useDataSource();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { if (!auth.loading && auth.user && auth.isOwner) router.replace("/"); }, [auth, router]);
  const q = useQuery({ queryKey: ["client-data"], queryFn: () => ds.queries.clientData(), enabled: auth.isClient });
  const refresh = () => qc.invalidateQueries({ queryKey: ["client-data"] });
  const signOut = async () => { await qc.cancelQueries(); qc.clear(); await ds.auth.signOut(); router.replace("/auth"); };

  const decide = async (id: string, approved: boolean) => {
    setBusy(id); setMsg(null);
    const r = await ds.commands.clientResolveApproval(id, approved, "");
    setBusy(null);
    setMsg(r.error ? r.error.message : approved ? "Approved. Thank you." : "Rejected. Your note has gone to the agency.");
    refresh();
  };

  const data = q.data;
  const name = (pid: string | null) => data?.projects.find((p) => p.id === pid)?.name ?? "";
  const pending = data?.approvals.filter((a) => a.status === "REQUESTED") ?? [];
  const isOwner = auth.user?.memberships[0]?.role === "CLIENT_OWNER";

  return <main className="command-center">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><span /></span><span>DEVPLAYBOOK <em>/</em> CLIENT</span></div>
      <div className="topbar-center"><span className="live-dot" /> {pending.length} AWAITING YOUR SIGNATURE</div>
      <div className="topbar-right">
        <Button variant="ghost" size="icon" className="icon-button" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut size={16} /></Button>
        <span className="avatar">{(auth.user?.email ?? "CL").slice(0, 2).toUpperCase()}</span>
      </div>
    </header>
    <div className="workspace"><div className="client-wrap">
      <div className="eyebrow gold">CLIENT CENTER</div>
      <h2 className="manage-title">Your projects<span className="period">.</span></h2>
      {q.isError && <div className="empty-state"><b>Couldn't load your projects.</b><p>{(q.error as Error).message}</p></div>}
      {!data && !q.isError && <div className="empty-state"><span className="pulse-dot" /><b>Loading…</b></div>}
      {data && <>
        <div className="section-label"><span>PROJECTS</span><span>{data.projects.length}</span></div>
        {data.projects.length === 0 ? <Empty title="No projects yet.">Projects appear here once the agency starts work for you.</Empty> :
          data.projects.map((p) => <div key={p.id} className="resolved-row"><span>{p.name}<small>{p.objective ?? p.description ?? ""}</small></span><span className={`pill ${statusTone(p.status)}`}>{label(p.status).toUpperCase()}</span></div>)}

        <div className="section-label pd-label"><span>NEEDS YOUR SIGNATURE</span><span>{pending.length}</span></div>
        {msg && <p className="mmsg">{msg}</p>}
        {pending.length === 0 ? <Empty title="Nothing awaits your signature." /> :
          pending.map((a) => <div key={a.id} className="resolved-row"><span>{a.title}<small>{name(a.project_id)} · {a.reason}</small></span>
            {isOwner ? <span><Button variant="outline" className="reject-btn" disabled={busy === a.id} onClick={() => decide(a.id, false)}>Reject</Button> <Button className="approve-btn" disabled={busy === a.id} onClick={() => decide(a.id, true)}>Approve</Button></span> : <small>Your organization&apos;s owner decides this.</small>}</div>)}

        <div className="section-label pd-label"><span>WHAT WE NEED FROM YOU</span><span>{data.requirements.filter((r) => r.status !== "RECEIVED").length}</span></div>
        {data.requirements.length === 0 ? <Empty title="Nothing outstanding." /> :
          data.requirements.map((r) => <div key={r.id} className="resolved-row"><span>{r.name}<small>{name(r.project_id)} · {r.response ?? r.description}</small></span><span className={`pill ${statusTone(r.status)}`}>{label(r.status).toUpperCase()}</span></div>)}

        <div className="section-label pd-label"><span>DELIVERABLES</span><span>{data.artifacts.length}</span></div>
        {data.artifacts.length === 0 ? <Empty title="No deliverables shared yet." /> :
          data.artifacts.map((f) => <div key={f.id} className="resolved-row"><span>{f.name}<small>{name(f.project_id)} · {f.description ?? ""} · {fmtDate(f.created_at)}</small></span><span className={`pill ${statusTone(f.status)}`}>{label(f.status).toUpperCase()}</span></div>)}

        {auth.user && auth.user.memberships[0] && <>
          <div className="section-label pd-label"><span>YOUR LIBRARY</span></div>
          <Library organizationId={auth.user.memberships[0].organizationId} canWrite={auth.user.memberships[0].role === "CLIENT_OWNER"} canPromote={auth.user.memberships[0].role === "CLIENT_OWNER"} uploadedBy="CLIENT_PROVIDED" />
        </>}

        <div className="section-label pd-label"><span>TIMELINE</span><span>{data.events.length}</span></div>
        {data.events.length === 0 ? <Empty title="No updates yet." /> :
          data.events.slice(0, 15).map((e) => <div key={e.id} className="resolved-row"><span>{e.summary}<small>{name(e.project_id)} · {fmtAgo(e.created_at)}</small></span></div>)}
      </>}
    </div></div>
  </main>;
}
