import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { inviteClient } from "@/lib/invites.functions";
import { type OwnerData, PROJECT_STATUSES, TASK_STATUSES, label, statusTone, fmtDate, logEvent } from "@/lib/v4";
import { Empty } from "./views";

type P = { data: OwnerData; refresh: () => void; initialProjectId?: string };

function useAction(refresh: () => void) {
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string, ev?: Parameters<typeof logEvent>[0]) => {
    setMsg(null);
    const { error } = await fn();
    if (error) { setMsg(error.message); return false; }
    if (ev) await logEvent(ev);
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
  const [name, setName] = useState(""); const [mission, setMission] = useState("");
  const { msg, run } = useAction(refresh);
  return <div className="manage-grid"><form className="mform" onSubmit={async (e) => { e.preventDefault(); if (await run(() => supabase.from("organizations").insert({ name: name.trim(), mission: mission.trim() || null }), "Organization added.")) { setName(""); setMission(""); } }}>
    <h4>New organization</h4><input required maxLength={200} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} /><input maxLength={500} placeholder="Mission (optional)" value={mission} onChange={(e) => setMission(e.target.value)} /><Button className="approve-btn" type="submit">Add</Button>{msg && <p className="mmsg">{msg}</p>}</form>
    <div className="mlist">{data.organizations.length === 0 ? <Empty title="No organizations yet." /> : data.organizations.map((o) => <div key={o.id} className="resolved-row"><span>{o.name}<small>{o.mission ?? "No mission set"} · {data.projects.filter((p) => p.organization_id === o.id).length} projects</small></span></div>)}</div></div>;
}

function Clients({ data, refresh }: P) {
  const invite = useServerFn(inviteClient);
  const [email, setEmail] = useState(""); const [ids, setIds] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const r = await invite({ data: { email, projectIds: ids, redirectTo: window.location.origin + "/reset-password" } });
      setMsg(r.invited ? `Invitation emailed to ${email}.` : `${email} already has an account — project access updated.`);
      setEmail(""); setIds([]); refresh();
    } catch (err) { setMsg(err instanceof Error ? err.message : "Invite failed."); }
    finally { setBusy(false); }
  };
  const unlink = async (project_id: string, user_id: string) => { await supabase.from("project_clients").delete().eq("project_id", project_id).eq("user_id", user_id); refresh(); };
  return <div className="manage-grid"><form className="mform" onSubmit={submit}><h4>Invite a client</h4>
    <input type="email" required maxLength={255} placeholder="client@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
    <div className="checks">{data.projects.length === 0 ? <small>Create a project first to give access.</small> : data.projects.map((p) => <label key={p.id}><input type="checkbox" checked={ids.includes(p.id)} onChange={(e) => setIds(e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id))} /> {p.name}</label>)}</div>
    <Button className="approve-btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Send invitation"}</Button>{msg && <p className="mmsg">{msg}</p>}</form>
    <div className="mlist">{data.clients.length === 0 ? <Empty title="No clients yet." /> : data.clients.map((c) => <div key={c.id} className="client-card"><b>{c.email}</b><div className="chips">{data.links.filter((l) => l.user_id === c.id).map((l) => <span key={l.project_id} className="chip">{data.projects.find((p) => p.id === l.project_id)?.name}<button aria-label="Remove access" onClick={() => unlink(l.project_id, c.id)}>×</button></span>)}{!data.links.some((l) => l.user_id === c.id) && <small>No project access</small>}</div></div>)}</div></div>;
}

function Projects({ data, refresh, initialProjectId }: P) {
  const [selected, setSelected] = useState<string | null>(initialProjectId ?? data.projects[0]?.id ?? null);
  const { msg, run } = useAction(refresh);
  const [f, setF] = useState({ name: "", description: "", objective: "", domains: "", priority: 50, organization_id: "" });
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: row, error } = await supabase.from("projects").insert({ name: f.name.trim(), description: f.description.trim() || null, objective: f.objective.trim() || null, priority: f.priority, organization_id: f.organization_id || null, domains: f.domains.split(",").map((d) => d.trim()).filter(Boolean) }).select().single();
    if (error) { await run(async () => ({ error }), ""); return; }
    await logEvent({ project_id: row.id, type: "PROJECT_CREATED", summary: `Project opened: ${row.name}`, client_visible: true });
    setF({ name: "", description: "", objective: "", domains: "", priority: 50, organization_id: "" }); setSelected(row.id); refresh();
  };
  const p = data.projects.find((x) => x.id === selected);
  return <div className="manage-grid">
    <div><form className="mform" onSubmit={create}><h4>New project</h4>
      <input required maxLength={200} placeholder="Project name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <textarea maxLength={2000} placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <input maxLength={500} placeholder="Objective" value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} />
      <input maxLength={300} placeholder="Departments, comma separated (e.g. Strategy, Design)" value={f.domains} onChange={(e) => setF({ ...f, domains: e.target.value })} />
      <div className="row2"><label>Priority<input type="number" min={0} max={100} value={f.priority} onChange={(e) => setF({ ...f, priority: Number(e.target.value) })} /></label>
      <label>Organization<select value={f.organization_id} onChange={(e) => setF({ ...f, organization_id: e.target.value })}><option value="">None</option>{data.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label></div>
      <Button className="approve-btn" type="submit">Create project</Button>{msg && <p className="mmsg">{msg}</p>}</form>
      <div className="mlist">{data.projects.map((x) => <button key={x.id} className={`proj-pick ${x.id === selected ? "active" : ""}`} onClick={() => setSelected(x.id)}>{x.name}<span className={`pill ${statusTone(x.status)}`}>{label(x.status).toUpperCase()}</span></button>)}</div></div>
    {p ? <ProjectDetail key={p.id} data={data} refresh={refresh} projectId={p.id} /> : <Empty title="Select or create a project." />}
  </div>;
}

function ProjectDetail({ data, refresh, projectId }: P & { projectId: string }) {
  const p = data.projects.find((x) => x.id === projectId)!;
  const { msg, run } = useAction(refresh);
  const pid = p.id;
  const [task, setTask] = useState({ title: "", domain: p.domains[0] ?? "general", risk: 1, approval_required: false });
  const [appr, setAppr] = useState({ title: "", reason: "", recommendation: "", consequences: "", risk: 2, reversibility: 3, requires_client: false });
  const [dec, setDec] = useState({ question: "", options: "", recommendation: "" });
  const [req, setReq] = useState({ name: "", description: "", assigned_to_client: true });
  const [ev, setEv] = useState({ claim: "", source: "", confidence: 70 });
  const [out, setOut] = useState({ metric: "", expected_value: "", actual_value: "" });
  const [upd, setUpd] = useState({ summary: "", share: true });
  const [del, setDel] = useState({ name: "", description: "", share: true, file: null as File | null });

  const uploadDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    let storage_path: string | null = null;
    if (del.file) {
      storage_path = `${pid}/deliverables/${crypto.randomUUID()}-${del.file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("project-files").upload(storage_path, del.file);
      if (error) { await run(async () => ({ error }), ""); return; }
    }
    if (await run(() => supabase.from("artifacts").insert({ project_id: pid, name: del.name.trim(), description: del.description.trim() || null, storage_path, client_visible: del.share, status: "FINAL" }), "Deliverable added.", { project_id: pid, type: "DELIVERABLE_SHARED", summary: `Deliverable: ${del.name.trim()}`, client_visible: del.share }))
      setDel({ name: "", description: "", share: true, file: null });
  };

  const tasks = data.tasks.filter((t) => t.project_id === pid);
  return <div className="project-detail">
    <div className="pd-head"><h3>{p.name}</h3>
      <select value={p.status} onChange={(e) => run(() => supabase.from("projects").update({ status: e.target.value as typeof p.status, ...(e.target.value === "COMPLETED" ? { completed_at: new Date().toISOString() } : {}), ...(e.target.value === "IN_PROGRESS" && !p.started_at ? { started_at: new Date().toISOString() } : {}) }).eq("id", pid), "Status updated.", { project_id: pid, type: "PROJECT_STATUS", summary: `${p.name} is now ${label(e.target.value)}`, client_visible: true })}>{PROJECT_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
    <p className="pd-sub">{p.description || "No description"} · Departments: {p.domains.join(", ") || "none"} · Clients: {data.links.filter((l) => l.project_id === pid).length}</p>
    {msg && <p className="mmsg">{msg}</p>}
    <div className="pd-forms">
      <form className="mform" onSubmit={async (e) => { e.preventDefault(); if (await run(() => supabase.from("tasks").insert({ project_id: pid, ...task, title: task.title.trim() }), "Task added.", { project_id: pid, type: "TASK_CREATED", summary: `Task: ${task.title.trim()}` })) setTask({ ...task, title: "" }); }}>
        <h4>Task</h4><input required maxLength={300} placeholder="Title" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} /><input maxLength={80} placeholder="Department" value={task.domain} onChange={(e) => setTask({ ...task, domain: e.target.value })} /><Button className="approve-btn" type="submit">Add task</Button></form>
      <form className="mform" onSubmit={async (e) => { e.preventDefault(); if (await run(() => supabase.from("approvals").insert({ project_id: pid, ...appr, title: appr.title.trim(), reason: appr.reason.trim() }), "Approval requested.", { project_id: pid, type: "APPROVAL_REQUESTED", summary: `Approval requested: ${appr.title.trim()}`, client_visible: appr.requires_client })) setAppr({ ...appr, title: "", reason: "", recommendation: "", consequences: "" }); }}>
        <h4>Approval request</h4><input required maxLength={300} placeholder="Proposed action" value={appr.title} onChange={(e) => setAppr({ ...appr, title: e.target.value })} /><textarea required maxLength={3000} placeholder="Reasoning" value={appr.reason} onChange={(e) => setAppr({ ...appr, reason: e.target.value })} /><input maxLength={1000} placeholder="Summary / recommendation" value={appr.recommendation} onChange={(e) => setAppr({ ...appr, recommendation: e.target.value })} /><input maxLength={1000} placeholder="Consequences" value={appr.consequences} onChange={(e) => setAppr({ ...appr, consequences: e.target.value })} />
        <div className="row2"><label>Risk 1–5<input type="number" min={1} max={5} value={appr.risk} onChange={(e) => setAppr({ ...appr, risk: Number(e.target.value) })} /></label><label>Reversibility 1–5<input type="number" min={1} max={5} value={appr.reversibility} onChange={(e) => setAppr({ ...appr, reversibility: Number(e.target.value) })} /></label></div>
        <label className="check"><input type="checkbox" checked={appr.requires_client} onChange={(e) => setAppr({ ...appr, requires_client: e.target.checked })} /> Client must approve too</label><Button className="approve-btn" type="submit">Request approval</Button></form>
      <form className="mform" onSubmit={async (e) => { e.preventDefault(); if (await run(() => supabase.from("decisions").insert({ project_id: pid, question: dec.question.trim(), options: dec.options.split(",").map((o) => o.trim()).filter(Boolean), recommendation: dec.recommendation.trim() || null, status: "WAITING_FOR_HUMAN" }), "Decision recorded.", { project_id: pid, type: "DECISION_PROPOSED", summary: `Decision raised: ${dec.question.trim()}` })) setDec({ question: "", options: "", recommendation: "" }); }}>
        <h4>Decision</h4><input required maxLength={500} placeholder="Question" value={dec.question} onChange={(e) => setDec({ ...dec, question: e.target.value })} /><input maxLength={500} placeholder="Options, comma separated" value={dec.options} onChange={(e) => setDec({ ...dec, options: e.target.value })} /><input maxLength={500} placeholder="Recommendation" value={dec.recommendation} onChange={(e) => setDec({ ...dec, recommendation: e.target.value })} /><Button className="approve-btn" type="submit">Record decision</Button></form>
      <form className="mform" onSubmit={async (e) => { e.preventDefault(); if (await run(() => supabase.from("context_requirements").insert({ project_id: pid, name: req.name.trim(), description: req.description.trim(), assigned_to_client: req.assigned_to_client, status: "REQUESTED" }), "Requirement added.", { project_id: pid, type: "CONTEXT_REQUESTED", summary: `Requirement requested: ${req.name.trim()}`, client_visible: req.assigned_to_client })) setReq({ ...req, name: "", description: "" }); }}>
        <h4>Requirement</h4><input required maxLength={200} placeholder="What's needed (e.g. Brand guidelines)" value={req.name} onChange={(e) => setReq({ ...req, name: e.target.value })} /><textarea maxLength={2000} placeholder="Details for the client" value={req.description} onChange={(e) => setReq({ ...req, description: e.target.value })} /><label className="check"><input type="checkbox" checked={req.assigned_to_client} onChange={(e) => setReq({ ...req, assigned_to_client: e.target.checked })} /> Ask the client</label><Button className="approve-btn" type="submit">Add requirement</Button></form>
      <form className="mform" onSubmit={uploadDeliverable}>
        <h4>Deliverable</h4><input required maxLength={200} placeholder="Name" value={del.name} onChange={(e) => setDel({ ...del, name: e.target.value })} /><input maxLength={1000} placeholder="Description" value={del.description} onChange={(e) => setDel({ ...del, description: e.target.value })} /><input type="file" onChange={(e) => setDel({ ...del, file: e.target.files?.[0] ?? null })} /><label className="check"><input type="checkbox" checked={del.share} onChange={(e) => setDel({ ...del, share: e.target.checked })} /> Share with client</label><Button className="approve-btn" type="submit">Add deliverable</Button></form>
      <form className="mform" onSubmit={async (e) => { e.preventDefault(); if (await run(() => supabase.from("events").insert({ project_id: pid, type: "UPDATE", summary: upd.summary.trim(), client_visible: upd.share }), "Update posted.")) setUpd({ ...upd, summary: "" }); }}>
        <h4>Timeline update</h4><textarea required maxLength={2000} placeholder="What happened?" value={upd.summary} onChange={(e) => setUpd({ ...upd, summary: e.target.value })} /><label className="check"><input type="checkbox" checked={upd.share} onChange={(e) => setUpd({ ...upd, share: e.target.checked })} /> Share with client</label><Button className="approve-btn" type="submit">Post update</Button></form>
      <form className="mform" onSubmit={async (e) => { e.preventDefault(); if (await run(() => supabase.from("evidence").insert({ project_id: pid, claim: ev.claim.trim(), source: ev.source.trim(), confidence: ev.confidence / 100 }), "Evidence added.")) setEv({ claim: "", source: "", confidence: 70 }); }}>
        <h4>Evidence</h4><input required maxLength={1000} placeholder="Claim" value={ev.claim} onChange={(e) => setEv({ ...ev, claim: e.target.value })} /><input required maxLength={300} placeholder="Source" value={ev.source} onChange={(e) => setEv({ ...ev, source: e.target.value })} /><label>Confidence %<input type="number" min={0} max={100} value={ev.confidence} onChange={(e) => setEv({ ...ev, confidence: Number(e.target.value) })} /></label><Button className="approve-btn" type="submit">Add evidence</Button></form>
      <form className="mform" onSubmit={async (e) => { e.preventDefault(); if (await run(() => supabase.from("outcomes").insert({ project_id: pid, ...out }), "Outcome recorded.", { project_id: pid, type: "OUTCOME", summary: `Outcome: ${out.metric}`, client_visible: true })) setOut({ metric: "", expected_value: "", actual_value: "" }); }}>
        <h4>Outcome</h4><input required maxLength={200} placeholder="Metric" value={out.metric} onChange={(e) => setOut({ ...out, metric: e.target.value })} /><div className="row2"><input required maxLength={100} placeholder="Expected" value={out.expected_value} onChange={(e) => setOut({ ...out, expected_value: e.target.value })} /><input required maxLength={100} placeholder="Actual" value={out.actual_value} onChange={(e) => setOut({ ...out, actual_value: e.target.value })} /></div><Button className="approve-btn" type="submit">Record outcome</Button></form>
    </div>
    <div className="section-label pd-label"><span>TASKS</span><span>{tasks.length}</span></div>
    {tasks.length === 0 ? <Empty title="No tasks yet." /> : tasks.map((t) => <div key={t.id} className="resolved-row"><span>{t.title}<small>{t.domain} · created {fmtDate(t.created_at)}{t.completed_at ? ` · done ${fmtDate(t.completed_at)}` : ""}</small></span>
      <select value={t.status} onChange={(e) => { const s = e.target.value as typeof t.status; run(() => supabase.from("tasks").update({ status: s, ...(s === "RUNNING" && !t.started_at ? { started_at: new Date().toISOString() } : {}), ...(s === "COMPLETED" ? { completed_at: new Date().toISOString() } : {}) }).eq("id", t.id), "Task updated.", { project_id: pid, type: "TASK_STATUS", summary: `${t.title}: ${label(s)}`, client_visible: s === "COMPLETED" }); }}>{TASK_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>)}
    <ClientResponses data={data} projectId={pid} />
  </div>;
}

function ClientResponses({ data, projectId }: { data: OwnerData; projectId: string }) {
  const reqs = data.requirements.filter((r) => r.project_id === projectId);
  if (!reqs.length) return null;
  return <><div className="section-label pd-label"><span>REQUIREMENTS</span><span>{reqs.length}</span></div>{reqs.map((r) => <div key={r.id} className="resolved-row"><span>{r.name}<small>{r.response ? `Response: ${r.response}` : r.description || "Awaiting response"}</small></span><span className={`pill ${statusTone(r.status)}`}>{label(r.status).toUpperCase()}</span></div>)}</>;
}
