"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { OwnerData } from "@/lib/model";
import { label, statusTone, fmtDate } from "@/lib/format";
import { useDataSource } from "@/lib/data";
import { Empty } from "./views";
import { Library } from "./library";
import { useStepUp } from "./step-up";
import type { OrgRole } from "@/lib/model";

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
  const [tab, setTab] = useState<"Projects" | "People" | "Organizations" | "Library">("Projects");
  return <div className="manage-wrap"><div className="eyebrow gold">CEO OFFICE / MANAGEMENT</div><h2 className="manage-title">Records & access<span className="period">.</span></h2>
    <div className="computer-tabs" role="tablist">{(["Projects", "People", "Organizations", "Library"] as const).map((t) => <Button key={t} role="tab" aria-selected={tab === t} variant="ghost" className={tab === t ? "tab active" : "tab"} onClick={() => setTab(t)}>{t}</Button>)}</div>
    {tab === "Projects" && <Projects data={data} refresh={refresh} initialProjectId={initialProjectId} />}
    {tab === "People" && <People data={data} refresh={refresh} />}
    {tab === "Organizations" && <Orgs data={data} refresh={refresh} />}
    {tab === "Library" && <OrgLibrary data={data} />}
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

function People({ data, refresh }: P) {
  const ds = useDataSource();
  const { guard, panel } = useStepUp();
  const [email, setEmail] = useState("");
  const [orgId, setOrgId] = useState(data.organizations[0]?.id ?? "");
  const [role, setRole] = useState<OrgRole>("CLIENT_OWNER");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    await guard(() => ds.commands.invitePerson({ organizationId: orgId, email: email.trim(), role }), (r) => {
      setBusy(false);
      if (r.error) { setMsg(r.error.message); return; }
      setMsg(`Invitation emailed to ${email.trim()}. It works once and signs them in.`); setEmail(""); refresh();
    });
    setBusy(false);
  };
  const remove = async (organizationId: string, userId: string) => { await ds.commands.removePerson(organizationId, userId); refresh(); };
  const orgName = (id: string) => data.organizations.find((o) => o.id === id)?.name ?? "Unknown";
  return <div className="manage-grid"><div>
    <form className="mform" onSubmit={submit}><h4>Invite someone</h4>
      <input type="email" required maxLength={255} placeholder="person@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <select aria-label="Organization" required value={orgId} onChange={(e) => setOrgId(e.target.value)}>{data.organizations.length === 0 && <option value="">Add an organization first</option>}{data.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as OrgRole)}><option value="CLIENT_OWNER">Owner (decides, invites, adds files)</option><option value="CLIENT_MEMBER">Member (read only)</option></select>
      <Button className="approve-btn" type="submit" disabled={busy || !orgId}>{busy ? "Sending…" : "Send invitation"}</Button>{msg && <p className="mmsg">{msg}</p>}</form>
    {panel}</div>
    <div className="mlist">{data.clients.length === 0 ? <Empty title="No clients yet." /> : data.clients.map((c) => <div key={c.id} className="client-card"><b>{c.email}</b><div className="chips">{c.memberships.map((m) => <span key={m.organization_id} className="chip">{orgName(m.organization_id)} · {m.role === "CLIENT_OWNER" ? "Owner" : "Member"}<button aria-label={`Remove from ${orgName(m.organization_id)}`} onClick={() => remove(m.organization_id, c.id)}>×</button></span>)}{c.memberships.length === 0 && <small>No access</small>}</div></div>)}</div></div>;
}

function OrgLibrary({ data }: { data: OwnerData }) {
  const [orgId, setOrgId] = useState(data.organizations[0]?.id ?? "");
  if (data.organizations.length === 0) return <Empty title="Add an organization first." />;
  return <div><select aria-label="Organization library" value={orgId} onChange={(e) => setOrgId(e.target.value)}>{data.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
    <Library key={orgId} organizationId={orgId} canWrite uploadedBy="CEO_PROVIDED" /></div>;
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

  const tasks = data.tasks.filter((t) => t.project_id === pid);
  return <div className="project-detail">
    <div className="pd-head"><h3>{p.name}</h3>
      <span className={`pill ${statusTone(p.status)}`}>{label(p.status)}</span></div>
    <p className="pd-sub">{p.wait_reason ? `Waiting: ${label(p.wait_reason)} · ` : ""}{p.description || "No description"} · Departments: {p.domains.join(", ") || "none"}</p>
    {msg && <p className="mmsg">{msg}</p>}
    <div className="pd-forms">
      {ds.capabilities.timelineUpdates && <form className="mform" onSubmit={async (e) => { e.preventDefault(); if (await run(() => ds.commands.postUpdate(pid, { summary: upd.summary.trim(), share: upd.share }), "Update posted.")) setUpd({ ...upd, summary: "" }); }}>
        <h4>Timeline update</h4><textarea required maxLength={2000} placeholder="What happened?" value={upd.summary} onChange={(e) => setUpd({ ...upd, summary: e.target.value })} /><label className="check"><input type="checkbox" checked={upd.share} onChange={(e) => setUpd({ ...upd, share: e.target.checked })} /> Share with client</label><Button className="approve-btn" type="submit">Post update</Button></form>}
    </div>
    {p.organization_id && <><div className="section-label pd-label"><span>FILES</span></div><Library organizationId={p.organization_id} projectId={pid} canWrite uploadedBy="CEO_PROVIDED" /></>}
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
