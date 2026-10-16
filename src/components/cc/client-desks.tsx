"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtAgo, fmtDate, label, statusTone } from "@/lib/format";
import type { ClientData } from "@/lib/model";
import { Empty } from "./views";
import { DeskFrame } from "./desk-frame";
import { useDomains } from "@/lib/domains";
import { FindBar, TextFind } from "./find-bar";
import { useProjectFind, type FindOption } from "@/lib/find";
import { Library } from "./library";
import { ClientIntentList, Composer } from "./intents";
import { ProjectRoom, QuestionsList } from "./runs";
import { BriefArchive, NotificationSettings } from "./briefs";
import { StandingPermission } from "./standing";

/**
 * The client room's desks. Each one sits behind an object in the room and opens on one layer of the information the client used to
 * get all at once in a single scroll. Everything is the same data and the same components as before; only how it is reached changed.
 */
type Common = { data: ClientData; isOwner: boolean };
const projectName = (data: ClientData, pid: string | null) => data.projects.find((p) => p.id === pid)?.name ?? "";

/** The round table: the work itself. One project at a time, then the story so far. */
export function ProjectsDesk({ data, isOwner }: Common) {
  const [tab, setTab] = useState<"projects" | "timeline">("projects");
  const { nameOf } = useDomains();
  const find = useProjectFind(data.projects, nameOf);
  const [pid, setPid] = useState<string | undefined>(data.projects[0]?.id);
  const chosen = find.results.find((p) => p.id === pid) ?? find.results[0];
  // the timeline: words to find, and one project at a time
  const [eq, setEq] = useState("");
  const [ep, setEp] = useState("ALL");
  const ew = eq.toLowerCase().split(/\s+/).filter(Boolean);
  const events = data.events.filter((e) => (ep === "ALL" || e.project_id === ep) && (!ew.length || ew.every((w) => `${e.summary} ${projectName(data, e.project_id)}`.toLowerCase().includes(w))));
  const projectChips: FindOption[] = [{ id: "ALL", label: "All", count: data.events.length }, ...data.projects.map((p) => ({ id: p.id, label: p.name, count: data.events.filter((e) => e.project_id === p.id).length })).filter((c) => c.count > 0)];
  const chips = find.results.length > 1 ? <div className="desk-chips" role="group" aria-label="Choose a project">{find.results.map((p) => <Button key={p.id} variant="ghost" className="desk-chip" aria-pressed={chosen?.id === p.id} onClick={() => setPid(p.id)}>{p.name}</Button>)}</div> : null;
  return (
    <DeskFrame kind="table" eyebrow="THE WORK, ON THE TABLE" title="Your projects" line={`${data.projects.length} project${data.projects.length === 1 ? "" : "s"} · ${data.events.length} updates.`} tab={tab} onTab={setTab} tabs={[{ id: "projects", label: "Projects", count: data.projects.length }, { id: "timeline", label: "Timeline" }]} above={tab === "projects" && data.projects.length > 0 ? <><FindBar find={find} shown={find.results.length} onOnly={() => { const only = find.results[0]; if (only) setPid(only.id); }} />{chips}</> : undefined}>
      {tab === "projects" && (data.projects.length === 0
        ? <Empty title="No projects yet.">Projects appear here once the agency starts work for you.</Empty>
        : chosen ? <ProjectRoom key={chosen.id} project={chosen} canControl={isOwner} /> : <Empty title="No project matches.">Try fewer words, or clear the filters.</Empty>)}
      {tab === "timeline" && <>
        <TextFind noun="updates" q={eq} setQ={setEq} chips={projectChips} value={ep} onValue={setEp} chipsLabel="Filter by project" shown={events.length} total={data.events.length} />
        <div className="section-label"><span>TIMELINE</span><span>{events.length}</span></div>
        {data.events.length === 0 ? <Empty title="No updates yet." /> : events.length === 0 ? <Empty title="No update matches." /> : events.slice(0, 15).map((e) => <div key={e.id} className="resolved-row"><span>{e.summary}<small>{projectName(data, e.project_id)} · {fmtAgo(e.created_at)}</small></span></div>)}
      </>}
    </DeskFrame>
  );
}

/** The screen on the wall: what is waiting on the client, to sign or to supply. */
export function DecisionsDesk({ data, isOwner, busy, msg, onDecide }: Common & { busy: string | null; msg: string | null; onDecide: (id: string, approved: boolean) => void }) {
  const pending = data.approvals.filter((a) => a.status === "REQUESTED");
  const outstanding = data.requirements.filter((r) => r.status !== "RECEIVED");
  const [tab, setTab] = useState<"sign" | "need">(pending.length === 0 && outstanding.length > 0 ? "need" : "sign");
  return (
    <DeskFrame kind="screen" eyebrow="WAITING ON YOU" title="Decisions" line={pending.length + outstanding.length === 0 ? "Nothing is waiting on you." : `${pending.length} to sign · ${outstanding.length} to supply.`} tab={tab} onTab={setTab} tabs={[{ id: "sign", label: "Needs your signature", count: pending.length }, { id: "need", label: "What we need from you", count: outstanding.length }]}>
      {tab === "sign" && <>
        {msg && <p className="mmsg">{msg}</p>}
        {pending.length === 0 ? <Empty title="Nothing awaits your signature." /> : pending.map((a) => (
          <div key={a.id} className="resolved-row"><span>{a.title}<small>{projectName(data, a.project_id)} · {a.reason}</small></span>
            {isOwner
              ? <span><Button variant="outline" className="reject-btn" disabled={busy === a.id} onClick={() => onDecide(a.id, false)}>Reject</Button> <Button className="approve-btn" disabled={busy === a.id} onClick={() => onDecide(a.id, true)}>Approve</Button></span>
              : <small>Your organization&apos;s owner decides this.</small>}
          </div>
        ))}
      </>}
      {tab === "need" && <>
        {data.requirements.length === 0 ? <Empty title="Nothing outstanding." /> : data.requirements.map((r) => <div key={r.id} className="resolved-row"><span>{r.name}<small>{projectName(data, r.project_id)} · {r.response ?? r.description}</small></span><span className={`pill ${statusTone(r.status)}`}>{label(r.status).toUpperCase()}</span></div>)}
      </>}
    </DeskFrame>
  );
}

/** The pinboard: what the client has asked for, and what the work is asking back. */
export function RequestsDesk({ data, isOwner, organizationId, refresh, openQuestions }: Common & { organizationId: string | undefined; refresh: () => void; openQuestions: number }) {
  const [tab, setTab] = useState<"requests" | "questions">("requests");
  // What they must act on comes first (P6.21 P5): their requests and the questions in them. Writing a new one is a button that
  // opens the form, not a form that fills the first screen; with nothing asked yet, the form is open.
  const [writing, setWriting] = useState(data.intents.length === 0);
  return (
    <DeskFrame kind="board" eyebrow="ASKS, BOTH WAYS" title="Requests" line={`${data.intents.length} request${data.intents.length === 1 ? "" : "s"} · ${openQuestions} question${openQuestions === 1 ? "" : "s"} for you.`} tab={tab} onTab={setTab} tabs={[{ id: "requests", label: "Your requests", count: data.intents.length }, { id: "questions", label: "Questions from the work", count: openQuestions }]}>
      {tab === "requests" && <>
        {isOwner && organizationId && (writing
          ? <><div className="section-label"><span>NEW REQUEST</span></div><Composer organizations={[]} fixedOrganizationId={organizationId} onSubmitted={refresh} /></>
          : <Button className="new-request" onClick={() => setWriting(true)}><Plus size={16} /> New request</Button>)}
        <div className="section-label pd-label"><span>YOUR REQUESTS</span><span>{data.intents.length}</span></div>
        <ClientIntentList intents={data.intents} canAnswer={(i) => isOwner && i.source === "CLIENT_INTENT"} refresh={refresh} empty="No requests yet." />
      </>}
      {tab === "questions" && <QuestionsList audience="client" onChanged={refresh} />}
    </DeskFrame>
  );
}

/** The shelf: what the agency delivered, and what the client keeps on file. */
export function LibraryDesk({ data, organizationId, canWrite, tick }: Common & { organizationId: string | undefined; canWrite: boolean; tick: number }) {
  const [tab, setTab] = useState<"deliverables" | "library">("deliverables");
  return (
    <DeskFrame kind="shelf" eyebrow="WHAT YOU HAVE, WHAT WE MADE" title="Library" line={`${data.artifacts.length} deliverable${data.artifacts.length === 1 ? "" : "s"} shared with you.`} tab={tab} onTab={setTab} tabs={[{ id: "deliverables", label: "Deliverables", count: data.artifacts.length }, { id: "library", label: "Your library" }]}>
      {tab === "deliverables" && (data.artifacts.length === 0
        ? <Empty title="No deliverables shared yet." />
        : data.artifacts.map((f) => <div key={f.id} className="resolved-row"><span>{f.name}<small>{projectName(data, f.project_id)} · {f.description ?? ""} · {fmtDate(f.created_at)}</small></span><span className={`pill ${statusTone(f.status)}`}>{label(f.status).toUpperCase()}</span></div>))}
      {tab === "library" && organizationId && <Library key={tick} organizationId={organizationId} canWrite={canWrite} canPromote={canWrite} uploadedBy="CLIENT_PROVIDED" />}
    </DeskFrame>
  );
}

/** The lamp on the side table: how the client is kept informed, and what the agency may do without asking. */
export function BriefsDesk({ isOwner, organizationId, projectIds }: { isOwner: boolean; organizationId: string | undefined; projectIds: string[] }) {
  const [tab, setTab] = useState<"briefs" | "permission" | "told">("briefs");
  const tabs: { id: "briefs" | "permission" | "told"; label: string }[] = [{ id: "briefs", label: "Briefs" }, ...(isOwner ? [{ id: "permission" as const, label: "Standing permission" }, { id: "told" as const, label: "How you are told" }] : [])];
  let body: ReactNode = null;
  if (tab === "briefs") body = <BriefArchive limit={5} />;
  else if (tab === "permission" && organizationId) body = <StandingPermission organizationId={organizationId} projectIds={projectIds} />;
  else if (tab === "told") body = <NotificationSettings />;
  return (
    <DeskFrame kind="paper" eyebrow="KEPT IN THE LOOP" title="Briefs" line="What happened, and how you hear about it." tab={tab} onTab={setTab} tabs={tabs}>
      {body}
    </DeskFrame>
  );
}
