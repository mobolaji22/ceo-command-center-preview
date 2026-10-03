"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { OwnerData } from "@/lib/model";
import { label, statusTone, fmtDate } from "@/lib/format";
import { useDataSource } from "@/lib/data";
import { Empty } from "./views";

type P = { data: OwnerData; refresh: () => void; initialProjectId?: string | undefined };

function useAction(refresh: () => void) {
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setMsg(null);
    const { error } = await fn();
    if (error) { setMsg(error.message); return false; }
    setMsg(ok); refresh(); return true;
  };
  return { msg, setMsg, run };
}

export function ManageView({ data, refresh, initialProjectId }: P) {
  const [tab, setTab] = useState<"Projects" | "Clients" | "Organizations">("Projects");
  return <div className="manage-wrap"><div className="eyebrow gold">CEO OFFICE / MANAGEMENT</div><h2 className="manage-title">Records & access<span className="period">.</span></h2>
    <div className="computer-tabs" role="tablist">{(["Projects", "Clients", "Organizations"] as const).map((t) => <Button key={t} role="tab" aria-selected={tab === t} variant="ghost" className={tab === t ? "tab active" : "tab"} onClick={() => setTab(t)}>{t}</Button>)}</div>
    {tab === "Projects" && <Projects data={data} refresh={refresh} initialProjectId={initialProjectId} />}
    {tab === "Clients" && <Clients data={data} refresh={refresh} />}
    {tab === "Organizations" && <Orgs data={data} refresh={refresh} />}
  </div>;
}

function Orgs({ data, refresh }: P) {
  const ds = useDataSource();
  const [name, setName] = useState(""); const [mission, setMission] = useState("");
  const { msg, run } = useAction(refresh);
  return <div className="manage-grid"><form className="mform" onSubmit={async (e) => { e.preventDefault(); if (await run(() => ds.commands.createOrganization({ name: name.trim(), mission: mission.trim() || null }), "Organization added.")) { setName(""); setMission(""); } }}>
    <h4>New organization</h4><input required maxLength={200} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} /><input maxLength={500} placeholder="Mission (optional)" value={mission} onChange={(e) => setMission(e.target.value)} /><Button className="approve-btn" type="submit">Add</Button>{msg && <p className="mmsg">{msg}</p>}</form>
    <div className="mlist">{data.organizations.length === 0 ? <Empty title="No organizations yet." /> : data.organizations.map((o) => <div key={o.id} className="resolved-row"><span>{o.name}<small>{o.mission ?? "No mission set"} · {data.projects.filter((p) => p.organization_id === o.id).length} projects</small></span></div>)}</div></div>;
}

function Clients({ data, refresh }: P) {
  const ds = useDataSource();
  const [email, setEmail] = useState(""); const [ids, setIds] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const res = await ds.commands.inviteClient({ email, projectIds: ids, redirectTo: window.location.origin + "/reset-password" });
      if (res.error || !res.data) throw new Error(res.error?.message ?? "Invite failed.");
      const r = res.data;
      setMsg(r.invited ? `Invitation emailed to ${email}.` : `${email} already has an account — project access updated.`);
      setEmail(""); setIds([]); refresh();
    } catch (err) { setMsg(err instanceof Error ? err.message : "Invite failed."); }
    finally { setBusy(false); }
  };
  const unlink = async (project_id: string, user_id: string) => { await ds.commands.unlinkClient(project_id, user_id); refresh(); };
  return <div className="manage-grid"><form className="mform" onSubmit={submit}><h4>Invite a client</h4>
    <input type="email" required maxLength={255} placeholder="client@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
    <div className="checks">{data.projects.length === 0 ? <small>Create a project first to give access.</small> : data.projects.map((p) => <label key={p.id}><input type="checkbox" checked={ids.includes(p.id)} onChange={(e) => setIds(e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id))} /> {p.name}</label>)}</div>
    <Button className="approve-btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Send invitation"}</Button>{msg && <p className="mmsg">{msg}</p>}</form>
    <div className="mlist">{data.clients.length === 0 ? <Empty title="No clients yet." /> : data.clients.map((c) => <div key={c.id} className="client-card"><b>{c.email}</b><div className="chips">{data.links.filter((l) => l.user_id === c.id).map((l) => <span key={l.project_id} className="chip">{data.projects.find((p) => p.id === l.project_id)?.name}<button aria-label="Remove access" onClick={() => unlink(l.project_id, c.id)}>×</button></span>)}{!data.links.some((l) => l.user_id === c.id) && <small>No project access</small>}</div></div>)}</div></div>;
}

function Projects({ data, refresh, initialProjectId }: P) {
  const ds = useDataSource();
  const [selected, setSelected] = useState<string | null>(initialProjectId ?? data.projects[0]?.id ?? null);
  const { msg, run } = useAction(refresh);
  const p = data.projects.find((x) => x.id === selected);
  return <div className="manage-grid">
    <div><p className="pd-sub">Projects begin as intents or directives. Issue one from the Directive desk.</p>
      <div className="mlist">{data.projects.map((x) => <button key={x.id} className={`proj-pick ${x.id === selected ? "active" : ""}`} onClick={() => setSelected(x.id)}>{x.name}<span className={`pill ${statusTone(x.status)}`}>{label(x.status).toUpperCase()}</span></button>)}</div></div>
    {p ? <ProjectDetail key={p.id} data={data} refresh={refresh} projectId={p.id} /> : <Empty title="Select a project." />}
  </div>;
}

function ProjectDetail({ data, refresh, projectId }: P & { projectId: string }) {
  const ds = useDataSource();
  const p = data.projects.find((x) => x.id === projectId)!;
  const { msg, run } = useAction(refresh);
  const pid = p.id;
  const [upd, setUpd] = useState({ summary: "", share: true });
  const [del, setDel] = useState({ name: "", description: "", share: true, file: null as File | null });

  const uploadDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run(() => ds.commands.addDeliverable(pid, { name: del.name.trim(), description: del.description.trim() || null, share: del.share, file: del.file }), "Deliverable added."))
      setDel({ name: "", description: "", share: true, file: null });
  };

  const tasks = data.tasks.filter((t) => t.project_id === pid);
  return <div className="project-detail">
    <div className="pd-head"><h3>{p.name}</h3>
      <span className={`pill ${statusTone(p.status)}`}>{label(p.status)}</span></div>
    <p className="pd-sub">{p.description || "No description"} · Departments: {p.domains.join(", ") || "none"} · Clients: {data.links.filter((l) => l.project_id === pid).length}</p>
    {msg && <p className="mmsg">{msg}</p>}
    <div className="pd-forms">
      <form className="mform" onSubmit={uploadDeliverable}>
        <h4>Deliverable</h4><input required maxLength={200} placeholder="Name" value={del.name} onChange={(e) => setDel({ ...del, name: e.target.value })} /><input maxLength={1000} placeholder="Description" value={del.description} onChange={(e) => setDel({ ...del, description: e.target.value })} /><input type="file" onChange={(e) => setDel({ ...del, file: e.target.files?.[0] ?? null })} /><label className="check"><input type="checkbox" checked={del.share} onChange={(e) => setDel({ ...del, share: e.target.checked })} /> Share with client</label><Button className="approve-btn" type="submit">Add deliverable</Button></form>
      <form className="mform" onSubmit={async (e) => { e.preventDefault(); if (await run(() => ds.commands.postUpdate(pid, { summary: upd.summary.trim(), share: upd.share }), "Update posted.")) setUpd({ ...upd, summary: "" }); }}>
        <h4>Timeline update</h4><textarea required maxLength={2000} placeholder="What happened?" value={upd.summary} onChange={(e) => setUpd({ ...upd, summary: e.target.value })} /><label className="check"><input type="checkbox" checked={upd.share} onChange={(e) => setUpd({ ...upd, share: e.target.checked })} /> Share with client</label><Button className="approve-btn" type="submit">Post update</Button></form>
    </div>
    <div className="section-label pd-label"><span>TASKS</span><span>{tasks.length}</span></div>
    {tasks.length === 0 ? <Empty title="No tasks yet." /> : tasks.map((t) => <div key={t.id} className="resolved-row"><span>{t.title}<small>{t.domain} · created {fmtDate(t.created_at)}{t.completed_at ? ` · done ${fmtDate(t.completed_at)}` : ""}</small></span>
</div>)}
    <ClientResponses data={data} projectId={pid} />
  </div>;
}

function ClientResponses({ data, projectId }: { data: OwnerData; projectId: string }) {
  const reqs = data.requirements.filter((r) => r.project_id === projectId);
  if (!reqs.length) return null;
  return <><div className="section-label pd-label"><span>REQUIREMENTS</span><span>{reqs.length}</span></div>{reqs.map((r) => <div key={r.id} className="resolved-row"><span>{r.name}<small>{r.response ? `Response: ${r.response}` : r.description || "Awaiting response"}</small></span><span className={`pill ${statusTone(r.status)}`}>{label(r.status).toUpperCase()}</span></div>)}</>;
}
