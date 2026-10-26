"use client";

import { BriefArchive, NotificationSettings, PhoneBriefs } from "./briefs";
import { GovernancePanel, PlanDecisionLedger } from "./ledger";
import { CaseFileToggle, PhoneQuestions, Standing } from "./runs";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, FileText, LockKeyhole, MoreHorizontal, Plus, Radio, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OwnerData, Approval } from "@/lib/model";
import { label, riskLabel, reversibilityLabel, statusTone, fmtDate, fmtAgo, pad } from "@/lib/format";
import { useDataSource } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { Composer, INTENT_STATUS_WORDS, IntentCard, intentTone } from "./intents";
import { directiveNeedsYou } from "@/lib/attention";
import { useDomains } from "@/lib/domains";
import { FindBar, Marked } from "./find-bar";
import { useProjectFind } from "@/lib/find";

type Common = { data: OwnerData; refresh: () => void };
const CLOSED = ["COMPLETED", "CANCELLED", "ARCHIVED"];
const projectName = (data: OwnerData, id: string | null) => data.projects.find((p) => p.id === id)?.name ?? "Organization-wide";

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="empty-state"><span className="pulse-dot" /><div><b>{title}</b>{children && <p>{children}</p>}</div></div>;
}

export function ComputerView({ data, openContracts, openBrief, openManage }: Common & { openContracts: (projectId?: string) => void; openBrief: () => void; openManage: (projectId?: string) => void }) {
  const ds = useDataSource();
  const [tab, setTab] = useState("Cases & Engagements");
  const active = data.projects.filter((p) => !CLOSED.includes(p.status));
  // The dossiers open on what is in motion; the scope lets you look at what is finished, or at everything.
  const [scope, setScope] = useState<"ACTIVE" | "CLOSED" | "ALL">("ACTIVE");
  const scoped = useMemo(() => data.projects.filter((p) => (scope === "ALL" ? true : scope === "ACTIVE" ? !CLOSED.includes(p.status) : CLOSED.includes(p.status))), [data.projects, scope]);
  const { nameOf } = useDomains();
  const find = useProjectFind(scoped, nameOf);
  const pending = data.approvals.filter((a) => a.status === "REQUESTED");
  const blocked = data.tasks.filter((t) => t.status === "BLOCKED" || t.status === "FAILED");
  const exceptions = pending.length + blocked.length;
  return <div className="computer-frame">
    <div className="window-bar"><div className="traffic-dots"><i /><i /><i /></div><span>&gt; DevPlaybook V4 Core Canonical Operating System <span className="window-muted">//</span> State: <strong>Synchronized DPL-01</strong></span><MoreHorizontal size={18} /></div>
    <div className="computer-body"><div className="computer-heading"><div><div className="eyebrow gold">THE ORGANIZATIONAL NERVOUS SYSTEM</div><h2>Operating overview<span className="period">.</span></h2><p>{data.projects.length} projects · {data.tasks.length} tasks · {data.decisions.length} decisions on record.</p></div><div className="system-time"><Radio size={15} /> {ds.kind === "api" ? "LIVE FROM DEVPLAYBOOK V4" : "DEMO FIXTURES"}</div></div>
      <div className="computer-tabs" role="tablist">{["Cases & Engagements", "Decision Ledger", "Security/Gov"].map((t) => <Button key={t} role="tab" aria-selected={tab === t} variant="ghost" className={tab === t ? "tab active" : "tab"} onClick={() => setTab(t)}>{t}</Button>)}</div>
      {tab === "Cases & Engagements" && <div className="computer-content"><div className="section-label"><span>ACTIVE DOSSIERS</span><span>{pad(active.length)} IN MOTION</span></div>
        {data.projects.length > 0 && <FindBar find={find} shown={find.results.length} showDept extra={<select className="find-select" aria-label="Show" value={scope} onChange={(e) => setScope(e.target.value as "ACTIVE" | "CLOSED" | "ALL")}><option value="ACTIVE">In motion</option><option value="CLOSED">Finished</option><option value="ALL">Everything</option></select>} />}
        {active.length === 0 && scope === "ACTIVE" ? <Empty title="No active projects yet.">Projects begin when a request or a directive is sent. Open the Directive desk to send one.</Empty> : find.results.length === 0 ? <Empty title="No project matches.">Try fewer words, another scope, or clear the filters.</Empty> :
        <div className="dossier-list">{find.results.map((p, i) => {
          const hasPending = pending.some((a) => a.project_id === p.id);
          return <div key={p.id} className="dossier-row with-case"><span className="row-index">{pad(i + 1)}</span><div><b><Marked text={p.name} q={find.q} /></b><small>{p.domains.length ? p.domains.join(" · ") : "No department"} · Priority {p.priority}</small></div>{hasPending ? <span className="pill amber">CEO REVIEW</span> : <Standing projectId={p.id} fallback={{ text: label(p.status).toUpperCase(), tone: statusTone(p.status) }} />}<CaseFileToggle projectId={p.id} name={p.name} audience="agency" canControl /><Button variant="ghost" size="icon" className="icon-button" aria-label={`Open ${p.name}`} onClick={() => hasPending ? openContracts(p.id) : openManage(p.id)}><ArrowRight size={17} /></Button></div>;
        })}</div>}
        <div className="computer-lower"><div><div className="section-label">SIGNAL HEALTH</div><h3>{exceptions === 0 ? "Steady. Nothing needs you." : `Steady, with ${exceptions} exception${exceptions > 1 ? "s" : ""}.`}</h3><p>{pending.length} approval{pending.length === 1 ? "" : "s"} awaiting signature · {blocked.length} blocked or failed task{blocked.length === 1 ? "" : "s"}.</p></div><Button variant="ghost" className="inline-arrow" onClick={openBrief}>VIEW EXECUTIVE BRIEF <ArrowRight size={16} /></Button></div></div>}
      {tab === "Decision Ledger" && <div className="computer-content"><div className="section-label"><span>DECISION LEDGER</span><span>TRACEABLE BY DESIGN</span></div>
        <PlanDecisionLedger data={data} />
        {data.decisions.length > 0 && <div className="section-label"><span>OTHER DECISIONS</span><span>{pad(data.decisions.length)}</span></div>}
        {data.decisions.length === 0 ? <Empty title="No decisions recorded yet." /> :
        <div className="dossier-list">{data.decisions.map((d, i) => <div key={d.id} className="dossier-row"><span className="row-index">{pad(i + 1)}</span><div><b>{d.question}</b><small>{projectName(data, d.project_id)} · {d.resolved_at ? `Resolved ${fmtDate(d.resolved_at)}` : `Raised ${fmtDate(d.created_at)}`}{d.selected_option ? ` · Chose: ${d.selected_option}` : ""}</small></div><span className={`pill ${statusTone(d.status)}`}>{label(d.status).toUpperCase()}</span><span /></div>)}</div>}</div>}
      {tab === "Security/Gov" && <div className="computer-content"><div className="section-label"><span>SECURITY & GOVERNANCE</span><span>PROTOCOL ACTIVE</span></div>
        <GovernancePanel data={data} />
        <div className="governance-grid">
        <div><ShieldCheck size={25} /><h3>Authorization controls</h3><p>{pending.length} requested · {data.approvals.filter((a) => a.status === "GRANTED").length} granted · {data.approvals.filter((a) => a.status === "REJECTED").length} rejected.</p><span className="pill green">ENFORCED</span></div>
        <div><LockKeyhole size={25} /><h3>Evidence integrity</h3><p>{data.evidence.length} evidence records across {new Set(data.evidence.map((e) => e.project_id)).size} projects.</p><span className={`pill ${data.evidence.length ? "green" : "muted"}`}>{data.evidence.length ? "RECORDED" : "NONE YET"}</span></div>
      </div></div>}
    </div></div>;
}

/** The phone is where a person says how they want to be told, so it sits behind a button on the phone itself. */
function PhoneSettings() {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="ghost" className="phone-decision" aria-expanded={open} onClick={() => setOpen(!open)}><span>How you are told<small>Quiet hours, urgency, email, digest</small></span><ChevronDown size={16} /></Button>
    {open && <div className="phone-settings"><NotificationSettings /></div>}
  </>;
}

export function PhoneView({ data, openBrief, openContracts }: Common & { openBrief: () => void; openContracts: (projectId?: string) => void }) {
  const auth = useAuth();
  const pending = data.approvals.filter((a) => a.status === "REQUESTED");
  const blocked = data.tasks.filter((t) => t.status === "BLOCKED" || t.status === "FAILED");
  const asking = data.intents.filter((i) => i.source === "CEO_DIRECTIVE" && i.questions.length > 0);
  const latest = data.events[0];
  const hour = new Date().getHours();
  const now = new Date();
  return <div className="phone-layout"><div className="phone-intro"><div className="eyebrow gold">AGENCY PULSE / MOBILE CHANNEL</div><h2>Clarity in<br /><i>your pocket.</i></h2><p>The essentials, wherever the day takes you.</p><div className="phone-intro-rule" /><span>01 &nbsp; / &nbsp; EXECUTIVE ATTENTION</span></div>
    <div className="phone-shell"><div className="phone-hardware"><span className="speaker" /><span className="camera" /></div><div className="phone-screen"><div className="phone-top"><span>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><span>●●● &nbsp; ▰</span></div><div className="phone-content">
      <div className="phone-app-head"><span className="phone-app-logo">D/</span><span className="pill amber">● AGENCY PULSE CHANNEL</span></div>
      <div className="phone-greeting">Good {hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, {auth.user?.displayName ?? "there"}.</div>
      <h3>Executive<br />Attention<span className="period">.</span></h3>
      <div className="phone-meta">{now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long" }).toUpperCase()} <span>{pad(pending.length + blocked.length + asking.length)} ITEMS NEED YOU</span></div>
      <div className="phone-card brief-card"><div className="phone-card-top"><Sparkles size={16} /><span>DAILY EXECUTIVE BRIEF</span><ArrowRight size={15} /></div><p>What happened while I was away?</p><Button variant="ghost" className="phone-card-link" onClick={openBrief}>READ YOUR BRIEF <ArrowRight size={14} /></Button></div>
      <div className="phone-section-title">Decisions Requiring<br />CEO Signature <span>{pad(pending.length)}</span></div>
      {pending.length === 0 ? <div className="phone-info"><Check size={15} /><span>Nothing awaiting signature<small>You're clear</small></span></div> :
        pending.slice(0, 3).map((a) => <Button key={a.id} variant="ghost" className="phone-decision" onClick={() => openContracts(a.project_id)}><span>{a.title}<small>{projectName(data, a.project_id)}</small><span className="risk-badges"><em>{riskLabel(a.risk)} risk</em><em>{reversibilityLabel(a.reversibility)} reversibility</em></span></span><ArrowRight size={16} /></Button>)}
      {asking.length > 0 && <><div className="phone-section-title small-title">Questions On Your Directives <span>{pad(asking.length)}</span></div>
        {asking.slice(0, 2).map((i) => <div key={i.id} className="phone-info"><CircleAlert size={15} /><span>{i.questions[0]?.question}<small>{i.text.slice(0, 60)}</small></span></div>)}</>}
      <PhoneQuestions open={openContracts} />
      <PhoneBriefs open={openBrief} />
      <PhoneSettings />
      <div className="phone-section-title small-title">Exceptions Detected <span>{pad(blocked.length)}</span></div>
      {blocked.length === 0 ? <div className="phone-info"><Check size={15} /><span>No blocked work<small>All tasks flowing</small></span></div> :
        blocked.slice(0, 2).map((t) => <div key={t.id} className="phone-info"><CircleAlert size={15} /><span>{t.title}<small>{label(t.status)} · {projectName(data, t.project_id)}</small></span></div>)}
      <div className="phone-section-title small-title">Nervous System Activity</div>
      <div className="phone-info"><Activity size={15} /><span>{latest ? latest.summary : "No activity yet"}<small>{latest ? fmtAgo(latest.created_at) : "Waiting for the first signal"}</small></span></div>
    </div><div className="phone-home" /></div></div></div>;
}

export function ContractsView({ data, refresh, focusProjectId }: Common & { focusProjectId?: string | undefined }) {
  const ds = useDataSource();
  const pending = data.approvals.filter((a) => a.status === "REQUESTED");
  const ordered = focusProjectId ? [...pending].sort((a, b) => (a.project_id === focusProjectId ? -1 : 0) - (b.project_id === focusProjectId ? -1 : 0)) : pending;
  const [selectedId, setSelectedId] = useState<string | null>(ordered[0]?.id ?? null);
  const a = data.approvals.find((x) => x.id === selectedId) ?? ordered[0];
  const [tab, setTab] = useState<"Contract Review" | "Modify Constraints & Scope" | "Request Evidence">("Contract Review");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Start the text from the record whenever the tab or the authorization changes (adjusted during render, not in an effect).
  const draftFor = `${tab}:${a?.id ?? ""}`;
  const [textFor, setTextFor] = useState(draftFor);
  if (textFor !== draftFor) { setTextFor(draftFor); setText(tab === "Modify Constraints & Scope" ? a?.constraints ?? "" : tab === "Request Evidence" ? a?.evidence_request ?? "" : ""); }

  const resolved = data.approvals.filter((x) => x.status !== "REQUESTED").slice(0, 6);
  if (!a) return <div className="contract-wrap"><div className="protocol-line"><ShieldCheck size={17} /><span>DEVPLAYBOOK GOVERNANCE PROTOCOL <span className="dot-divider">·</span> AUTHORIZATION CONTRACT</span></div>
    <div className="contract-body"><Empty title="No authorizations awaiting your signature.">New approval requests appear here as soon as they're raised.</Empty>
    {resolved.length > 0 && <ResolvedList data={data} items={resolved} />}</div></div>;

  const evidence = data.evidence.filter((e) => e.approval_id === a.id || (!e.approval_id && e.project_id === a.project_id));
  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, done: string) => {
    setBusy(true); setMsg(null);
    const { error } = await fn();
    if (error) { setMsg(error.message); setBusy(false); return; }
    setMsg(done); setBusy(false); refresh();
  };
  const resolve = async (approved: boolean) => {
    await run(() => ds.commands.resolveApproval(a.id, approved), `Decision ${approved ? "approved" : "rejected"} and recorded in the governance ledger.`);
    const next = pending.find((x) => x.id !== a.id); setSelectedId(next?.id ?? null);
  };
  const projectRef = `DPL-AC-${a.id.slice(0, 4).toUpperCase()}`;

  return <div className="contract-wrap"><div className="protocol-line"><ShieldCheck size={17} /><span>DEVPLAYBOOK GOVERNANCE PROTOCOL <span className="dot-divider">·</span> AUTHORIZATION CONTRACT</span><span className="protocol-id">{projectRef}</span></div>
    {ordered.length > 1 && <div className="approval-queue">{ordered.map((x, i) => <button key={x.id} className={x.id === a.id ? "active" : ""} onClick={() => { setSelectedId(x.id); setTab("Contract Review"); setMsg(null); }}><span>{pad(i + 1)}</span>{x.title}</button>)}</div>}
    {ds.capabilities.approvalNotes && <div className="contract-tabs" role="tablist">{(["Contract Review", "Modify Constraints & Scope", "Request Evidence"] as const).map((t) => <Button key={t} role="tab" aria-selected={tab === t} variant="ghost" className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</Button>)}</div>}
    <div className="contract-body"><div className="classification"><span><LockKeyhole size={15} /> CLASSIFICATION: {label(a.target_type).toUpperCase()} · {projectName(data, a.project_id).toUpperCase()}</span><strong>{a.requires_client ? "CLIENT & CEO APPROVAL" : "CEO APPROVAL REQUIRED"}</strong></div>
      {tab === "Contract Review" && <><div className="contract-columns"><div className="contract-main"><div className="eyebrow gold">01 / PROPOSED ACTION</div><h2>{a.title}<span className="period">.</span></h2>{a.recommendation && <p className="contract-lead">{a.recommendation}</p>}<div className="contract-rule" /><div className="eyebrow gold">02 / ORGANIZATIONAL REASONING</div><p className="reasoning">{a.reason}</p>
        {a.consequences && <><div className="eyebrow gold">03 / CONSEQUENCES</div><p className="reasoning">{a.consequences}</p></>}
        {a.constraints && <p className="reasoning"><b>Your constraints:</b> {a.constraints}</p>}
        {a.evidence_request && <p className="reasoning"><b>Evidence requested:</b> {a.evidence_request}</p>}
        <Button variant="ghost" className="evidence-trigger" onClick={() => setEvidenceOpen(!evidenceOpen)}><FileText size={17} /> Substantiating Evidence Trail ({evidence.length}) <ChevronDown size={16} className={evidenceOpen ? "rotated" : ""} /></Button>
        {evidenceOpen && <div className="evidence-list">{evidence.length === 0 ? <div>No evidence attached yet.</div> : evidence.map((e, i) => <div key={e.id}><span>{pad(i + 1)}</span> {e.claim} <small>{e.source} · {Math.round(e.confidence * 100)}% confidence</small></div>)}</div>}</div>
        <aside className="contract-aside"><div className="eyebrow">DECISION PROFILE</div><div className="aside-stat"><span>RISK LEVEL</span><strong>{riskLabel(a.risk)}</strong></div><div className="aside-stat"><span>REVERSIBILITY</span><strong>{reversibilityLabel(a.reversibility)}</strong></div><div className="aside-stat"><span>DECISION OWNER</span><strong>{a.requires_client ? "CEO + Client" : "Chief Executive Officer"}</strong></div><div className="aside-stat"><span>RAISED</span><strong>{fmtDate(a.created_at)}</strong></div><div className="aside-note"><ShieldCheck size={17} /> {a.requires_client ? "This is the client's decision. You can make it only with the permission their owner has given you; every use is recorded for them to see." : "Your decision is recorded in the governance ledger."}</div></aside></div>
        <div className="contract-actions"><span>{msg ?? "Review the evidence before resolving this authorization."}</span><div><Button variant="outline" className="reject-btn" disabled={busy} onClick={() => resolve(false)}>Reject proposal</Button><Button className="approve-btn" disabled={busy} onClick={() => resolve(true)}><Check size={16} /> Approve authorization</Button></div></div></>}
      {tab !== "Contract Review" && <div className="tab-pane"><div className="eyebrow gold">{tab === "Request Evidence" ? "ASK FOR CLARITY" : "CONTROL THE BOUNDARIES"}</div><h2>{tab === "Request Evidence" ? "Request evidence" : "Shape the scope"}<span className="period">.</span></h2><p>{tab === "Request Evidence" ? "Ask the organization to substantiate a part of this proposal before you decide." : "Specify the limits that must be met before authorization proceeds."}</p>
        <textarea aria-label={tab} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} placeholder={tab === "Request Evidence" ? "What additional evidence would help you make this decision?" : "e.g. Limit the discovery phase to 60 days…"} />
        {msg && <p>{msg}</p>}
        <Button className="approve-btn" disabled={busy || !text.trim()} onClick={() => tab === "Request Evidence"
          ? run(() => ds.commands.requestApprovalEvidence(a.id, text.trim()), "Evidence request recorded.")
          : run(() => ds.commands.setApprovalConstraints(a.id, text.trim()), "Constraints saved.")}>{tab === "Request Evidence" ? "Record request" : "Save constraints"} <ArrowRight size={16} /></Button></div>}
      {resolved.length > 0 && <ResolvedList data={data} items={resolved} />}
    </div></div>;
}

function ResolvedList({ data, items }: { data: OwnerData; items: Approval[] }) {
  return <div className="resolved-list"><div className="section-label"><span>RECENTLY RESOLVED</span><span>{items.length}</span></div>{items.map((x) => <div key={x.id} className="resolved-row"><span>{x.title}<small>{projectName(data, x.project_id)} · {fmtDate(x.resolved_at)}</small></span><span className={`pill ${statusTone(x.status)}`}>{label(x.status).toUpperCase()}</span></div>)}</div>;
}

type DirectiveTab = "needs" | "progress" | "closed" | "all";
/** Where a request sits on the directive desk. "Needs you" is what the desk's hotspot counts (lib/attention), so the two agree. */
function directiveTab(data: OwnerData, i: OwnerData["intents"][number]): Exclude<DirectiveTab, "all"> {
  if (i.status === "REJECTED" || i.status === "SUPERSEDED") return "closed";
  const project = data.projects.find((p) => p.id === i.project_id);
  if (project && CLOSED.includes(project.status)) return "closed";
  return directiveNeedsYou(i) ? "needs" : "progress";
}

/**
 * The CEO's directives, one layer at a time (P6.21's rule for desks): the requests sorted into tabs by what they need, a filter for
 * whom they are for, and one request opened at a time with what it asks and its plan on their own tabs. Writing a new one opens
 * the composer in place of the list; sending it opens the request it made.
 */
export function DirectiveView({ data, refresh, close }: Common & { close: () => void }) {
  const [writing, setWriting] = useState(data.intents.length === 0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [part, setPart] = useState<"asks" | "plan">("asks");
  const [forOrg, setForOrg] = useState<string>("*");
  // What the last send came back with, said once on the request it opened.
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null);
  const counts = { needs: 0, progress: 0, closed: 0, all: data.intents.length };
  for (const i of data.intents) counts[directiveTab(data, i)]++;
  const [tab, setTab] = useState<DirectiveTab>(counts.needs ? "needs" : "progress");
  const org = (id: string) => data.organizations.find((o) => o.id === id);
  const forName = (id: string) => (org(id)?.kind === "INTERNAL" ? "The agency's own work" : org(id)?.name ?? "A client");
  const shown = data.intents.filter((i) => (tab === "all" || directiveTab(data, i) === tab) && (forOrg === "*" || (forOrg === "INTERNAL" ? org(i.organization_id)?.kind === "INTERNAL" : i.organization_id === forOrg)));
  const opened = openId ? data.intents.find((i) => i.id === openId) ?? null : null;
  const openRequest = (i: OwnerData["intents"][number]) => { setOpenId(i.id); setPart(i.questions.length || i.materials.length || !i.project_id ? "asks" : "plan"); };
  const asksCount = (i: OwnerData["intents"][number]) => i.questions.length + i.materials.length;
  const clients = data.organizations.filter((o) => o.kind !== "INTERNAL");

  return <div className="directive-wrap">
    <div className="directive-head"><div><div className="eyebrow gold">INTENT FRAMING / CEO OFFICE</div><h2><span className="brain-symbol">✦</span> Executive Directive</h2>
      <p className="directive-principle">Set direction, resolve ambiguity, authorize what matters. For a client or for the agency itself.</p></div>
      <div className="directive-actions">{!writing && <Button className="new-request" onClick={() => { setWriting(true); setOpenId(null); }}><Plus size={16} /> New directive</Button>}
        {/* While writing, the form's own ✕ puts it away; one close at a time. */}
        {!writing && <Button variant="ghost" size="icon" className="icon-button" aria-label="Close directive" onClick={close}><X size={20} /></Button>}</div></div>

    {writing
      ? <Composer organizations={data.organizations} onSubmitted={(sent) => { refresh(); setWriting(false); setOpenId(sent.intentId); setNotice({ id: sent.intentId, text: sent.status === "CLARIFYING" ? "Received. A few questions will make it sharper." : sent.status === "PLANNED" || sent.status === "UNDERSTOOD" ? "Received and understood. The plan is ready for a decision." : "Received." }); setPart(sent.status === "CLARIFYING" ? "asks" : "plan"); setTab(sent.status === "CLARIFYING" ? "needs" : "progress"); }} onClose={data.intents.length ? () => setWriting(false) : undefined} />
      : opened
        ? <div className="directive-detail">
            <Button variant="ghost" className="back-link" onClick={() => { setOpenId(null); setNotice(null); }}><ArrowLeft size={14} /> ALL DIRECTIVES</Button>
            <div className="directive-detail-head"><div><small className="who">{forName(opened.organization_id)} · {fmtAgo(opened.created_at)}{opened.source === "CLIENT_INTENT" ? " · from the client" : " · from the agency"}</small><h3>{opened.text}</h3></div>
              <span className={`pill ${intentTone(opened.status)}`}>{(INTENT_STATUS_WORDS[opened.status] ?? label(opened.status)).toUpperCase()}</span></div>
            {notice?.id === opened.id && <p className="mmsg directive-notice" role="status">{notice.text}</p>}
            <div className="desk-tabs" role="tablist">
              {(["asks", "plan"] as const).map((t) => <Button key={t} role="tab" aria-selected={part === t} variant="ghost" className={part === t ? "tab active" : "tab"} disabled={t === "plan" && !opened.project_id} onClick={() => setPart(t)}>
                {t === "asks" ? "What it asks" : "The plan"}{t === "asks" && asksCount(opened) ? <span className="tab-count">{asksCount(opened)}</span> : null}</Button>)}
            </div>
            {part === "plan" && !opened.project_id ? <Empty title="No plan yet.">It is written once the request is understood.</Empty>
              : <IntentCard key={`${opened.id}:${part}`} intent={opened} part={part} canAnswer={opened.source === "CEO_DIRECTIVE"} refresh={refresh} />}
          </div>
        : <>
            <div className="directive-toolbar">
              <div className="desk-tabs" role="tablist">
                {([["needs", "Needs you"], ["progress", "In progress"], ["closed", "Closed"], ["all", "All"]] as const).map(([id, name]) =>
                  <Button key={id} role="tab" aria-selected={tab === id} variant="ghost" className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>{name}{counts[id] ? <span className="tab-count">{counts[id]}</span> : null}</Button>)}
              </div>
              <label className="directive-filter">FOR<select aria-label="Show directives for" value={forOrg} onChange={(e) => setForOrg(e.target.value)}>
                <option value="*">Everyone</option><option value="INTERNAL">The agency&apos;s own work</option>
                {clients.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
            </div>
            {shown.length === 0
              ? <Empty title={tab === "needs" ? "Nothing needs you here." : tab === "closed" ? "Nothing closed yet." : "Nothing here."}>{tab === "needs" ? "Questions and materials asked of you arrive in this tab." : null}</Empty>
              : <div className="directive-list">{shown.map((i) => <button key={i.id} className="directive-row" data-tab={directiveTab(data, i)} onClick={() => openRequest(i)}>
                  <span className="dr-text">{i.text}<small>{forName(i.organization_id)} · {fmtAgo(i.created_at)}{i.source === "CLIENT_INTENT" ? " · from the client" : ""}</small></span>
                  <span className="dr-state">{asksCount(i) > 0 && <em>{i.source === "CEO_DIRECTIVE" ? `${asksCount(i)} for you` : `${asksCount(i)} for the client`}</em>}<span className={`pill ${intentTone(i.status)}`}>{(INTENT_STATUS_WORDS[i.status] ?? label(i.status)).toUpperCase()}</span></span>
                  <ArrowRight size={14} aria-hidden="true" />
                </button>)}</div>}
          </>}
  </div>;
}

export function BriefView({ data, openContracts, openComputer }: Common & { openContracts: (projectId?: string) => void; openComputer: () => void }) {
  const ds = useDataSource();
  const [since, setSince] = useState<string | null>(null);
  // Without a last visit, the brief covers the week before it was opened.
  const [weekAgo] = useState(() => Date.now() - 7 * 864e5);
  useEffect(() => { void ds.commands.markSeen().then((d) => setSince(d ?? new Date(weekAgo).toISOString())); }, [ds, weekAgo]);
  const s = since ? new Date(since).getTime() : weekAgo;
  const recent = useMemo(() => data.events.filter((e) => new Date(e.created_at).getTime() > s), [data.events, s]);
  const pending = data.approvals.filter((a) => a.status === "REQUESTED");
  const waitingDecisions = data.decisions.filter((d) => d.status === "WAITING_FOR_HUMAN" || d.status === "PROPOSED");
  const done = data.tasks.filter((t) => t.completed_at && new Date(t.completed_at).getTime() > s);
  const blocked = data.tasks.filter((t) => t.status === "BLOCKED" || t.status === "FAILED");
  return <div className="brief-wrap"><div className="eyebrow gold"><Sparkles size={15} /> THE CEO BRIEF / {new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }).toUpperCase()}</div><h2>What happened while<br /><i>I was away?</i></h2><p className="brief-lead">Since {since ? new Date(since).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "your last visit"}: {recent.length} signal{recent.length === 1 ? "" : "s"}, {done.length} task{done.length === 1 ? "" : "s"} completed.</p><div className="brief-divider" />
    <div className="brief-grid"><div className="brief-feature"><span>01 / NEEDS YOUR JUDGMENT</span><h3>{pending.length + waitingDecisions.length === 0 ? "Nothing awaits your judgment." : `${pending.length} authorization${pending.length === 1 ? "" : "s"}, ${waitingDecisions.length} open decision${waitingDecisions.length === 1 ? "" : "s"}.`}</h3><p>{pending.slice(0, 3).map((a) => a.title).join(" · ") || "You're clear for now."}</p>{pending.length > 0 && <Button variant="ghost" className="inline-arrow" onClick={() => openContracts()}>REVIEW AUTHORIZATIONS <ArrowRight size={16} /></Button>}</div>
      <div className="brief-feature"><span>02 / ORGANIZATIONAL PULSE</span><h3>{blocked.length ? `${blocked.length} item${blocked.length > 1 ? "s" : ""} blocked.` : "Momentum is holding."}</h3><p>{done.length ? `Completed: ${done.slice(0, 3).map((t) => t.title).join(" · ")}` : "No tasks completed in this window."}</p><Button variant="ghost" className="inline-arrow" onClick={openComputer}>OPEN OPERATING SYSTEM <ArrowRight size={16} /></Button></div></div>
    <div className="brief-events"><div className="section-label"><span>WHAT CHANGED</span><span>{recent.length}</span></div>{recent.length === 0 ? <Empty title="No new signals since your last visit." /> : recent.slice(0, 12).map((e) => <div key={e.id} className="resolved-row"><span>{e.summary}<small>{projectName(data, e.project_id)} · {fmtAgo(e.created_at)}</small></span><span className="pill muted">{label(e.type).toUpperCase()}</span></div>)}</div>
    <div className="brief-events"><div className="section-label"><span>EVERYTHING YOU HAVE BEEN TOLD</span></div><BriefArchive limit={5} /></div>
    <div className="brief-signoff"><span className="live-dot" /> PREPARED BY DEVPLAYBOOK · EXECUTIVE INTELLIGENCE</div></div>;
}
