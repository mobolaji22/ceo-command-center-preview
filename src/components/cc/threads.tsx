"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CornerDownRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import type { Intent, ThreadState, ThreadSummary, ThreadView, WorkspaceView } from "@/lib/model";
import { fmtAgo, label } from "@/lib/format";
import { ClientIntentCard, Composer, INTENT_STATUS_WORDS, IntentCard, intentTone } from "./intents";
import { MessageItem } from "./conversation";
import { PlanPanel } from "./plans";
import { Empty } from "./views";

type Org = { id: string; name: string; kind?: "CLIENT" | "INTERNAL" | undefined };
type Part = "talk" | "asks" | "plan";
type Group = { key: string; org: WorkspaceView["organizations"][number]; name: string; isNew: boolean; objective: string | null; status: string | null; threads: ThreadSummary[] };

/** Where a thread stands, in a word, for the list (v4 ADR-0078 Decision 5). */
const STATE_WORDS: Record<ThreadState, string> = { NEEDS_YOU: "Needs you", WORKING: "In progress", WAITING: "Waiting", DONE: "Done" };
/** v4 says a thread needs an answer; whether it needs this person is theirs to know (the count on their desk): else it names who. */
function stateWord(state: ThreadState, mine: boolean, audience: "agency" | "client"): { state: ThreadState; word: string } {
  if (mine) return { state: "NEEDS_YOU", word: "Needs you" };
  if (state === "NEEDS_YOU") return { state: "WORKING", word: audience === "agency" ? "With the client" : "With your account owner" };
  return { state, word: STATE_WORDS[state] };
}

/** What a waiting thread waits for, said plainly, naming the thread it waits on. */
function waitLine(t: Pick<ThreadSummary, "state" | "waiting_for">, titleOf: (id: string | null) => string | null): string | null {
  const w = t.waiting_for;
  if (t.state !== "WAITING" || !w) return null;
  const on = titleOf(w.thread_id);
  if (w.reason === "PROJECT_NOT_OPEN") return `Starts once ${on ? `"${on}"` : "its project"} is understood and the project opens.`;
  const plan = w.version ? `version ${w.version} of the plan` : "the current plan";
  return `Planned with the next version, once ${plan}${on ? ` (from "${on}")` : ""} is decided.`;
}

/** While v4 is replying, the thread is read again now and then: the reply is written in v4's worker. */
const WAIT_POLL_MS = 8000;

/**
 * Projects and their threads (v4 ADR-0078), the same screen for the client and the CEO: on the left each project with its threads
 * (a feature v4 found opens as its own thread, under the one it came from), in the middle one thread's conversation, with what it
 * asks and the plan on tabs of their own, and on the right the project. The questions show only when that tab is chosen; the
 * conversation says how many there are and goes to them in a tap. Everything shown is v4's (INV-27).
 */
export function ThreadsScreen({ audience, intents, organizations, fixedOrganizationId, canWrite, needsMe, refresh, close, eyebrow, title }: {
  audience: "agency" | "client";
  /** The requests the person can see, for the cards on the "What it asks" tab. */
  intents: Intent[];
  /** Whom a new project can be for (the CEO's composer); a client writes only for their own organization. */
  organizations: Org[];
  fixedOrganizationId?: string | undefined;
  /** May the person answer and write on this request. */
  canWrite: (i: Intent) => boolean;
  /** Whether a request waits on this person (the count on the desk that opens this screen, so the two agree). */
  needsMe: (i: Intent) => boolean;
  refresh: () => unknown;
  close?: (() => void) | undefined;
  /** The screen's own heading; left out where the desk it sits on already has one. */
  eyebrow?: string | undefined;
  title?: string | undefined;
}) {
  const ds = useDataSource();
  const [tick, setTick] = useState(0);
  const stamp = intents.map((i) => `${i.id}:${i.status}:${i.questions.length}:${i.materials.length}:${i.plan_status ?? ""}`).join("|");
  const ws = useQuery({ queryKey: ["workspace", stamp, tick], queryFn: async () => (await ds.threads.workspace()).data, placeholderData: (prev) => prev });
  const [forOrg, setForOrg] = useState("*");
  // What waits on the person comes first, as the count on the desk that opened this says.
  const [only, setOnly] = useState<"all" | "needs">(() => (intents.some(needsMe) ? "needs" : "all"));
  const [openId, setOpenId] = useState<string | null>(null);
  const [part, setPart] = useState<Part>("talk");
  const mayStart = audience === "agency" || organizations.length > 0 || Boolean(fixedOrganizationId);
  // With nothing asked yet, the form is already open (P6.21).
  const [writing, setWriting] = useState(intents.length === 0 && mayStart);
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null);
  const byIntent = useMemo(() => new Map(intents.map((i) => [i.id, i])), [intents]);
  const reload = () => { setTick((n) => n + 1); void refresh(); };

  const groups: Group[] = useMemo(() => (ws.data?.organizations ?? []).flatMap((org) => [
    ...org.new_projects.map((n) => ({ key: `new:${n.thread_id}`, org, name: n.title, isNew: true, objective: null, status: null, threads: n.threads })),
    ...org.projects.filter((p) => p.threads.length > 0).map((p) => ({ key: p.project_id, org, name: p.name, isNew: false, objective: p.objective, status: p.status, threads: p.threads })),
  ]), [ws.data]);
  const all = groups.flatMap((g) => g.threads.map((t) => ({ t, g })));
  const titleOf = (id: string | null) => (id ? all.find((x) => x.t.thread_id === id)?.t.title ?? null : null);
  const needs = (t: ThreadSummary) => { const i = byIntent.get(t.current.intent_id); return i ? needsMe(i) : false; };
  const forName = (o: Group["org"]) => (o.kind === "INTERNAL" ? "The agency's own work" : o.name);
  const shownGroups = groups
    .filter((g) => forOrg === "*" || (forOrg === "INTERNAL" ? g.org.kind === "INTERNAL" : g.org.id === forOrg))
    .map((g) => ({ ...g, threads: g.threads.filter((t) => only === "all" || needs(t)) }))
    .filter((g) => g.threads.length > 0)
    .sort((a, b) => latest(b.threads).localeCompare(latest(a.threads)));
  const needCount = all.filter(({ t }) => needs(t)).length;
  // Opened from a sent request: the thread it went into, once the workspace has it.
  const [pending, setPending] = useState<string | null>(null);
  const openedId = openId ?? (pending ? all.find((x) => x.t.current.intent_id === pending)?.t.thread_id ?? null : null);
  const opened = openedId ? all.find((x) => x.t.thread_id === openedId) ?? null : null;
  const open = (threadId: string, first?: Part) => { setOpenId(threadId); setPending(null); setWriting(false); setPart(first ?? "talk"); };
  const sent = async (s: { intentId: string; status: string }) => {
    await refresh(); setTick((n) => n + 1);
    setWriting(false); setPending(s.intentId); setOpenId(null);
    setNotice({ id: s.intentId, text: s.status === "CLARIFYING" ? "Received. A few questions will make it sharper." : s.status === "PLANNED" || s.status === "UNDERSTOOD" ? "Received and understood. The plan is ready for a decision." : "Received." });
    setPart(s.status === "CLARIFYING" ? "asks" : s.status === "PLANNED" || s.status === "UNDERSTOOD" ? "plan" : "talk");
  };
  const startNew = () => { setWriting(true); setOpenId(null); setPending(null); };
  const clients = organizations.filter((o) => o.kind !== "INTERNAL");
  const loading = ws.isLoading && !ws.data;

  return <div className="threads-wrap" data-open={opened || writing ? "thread" : "list"}>
    {title && <div className="threads-head"><div><div className="eyebrow gold">{eyebrow}</div><h2>{title}</h2></div>
      <div className="directive-actions">
        {mayStart && !writing && <Button className="new-request" onClick={startNew}><Plus size={16} /> New project</Button>}
        {close && !writing && <Button variant="ghost" size="icon" className="icon-button" aria-label="Close" onClick={close}><X size={20} /></Button>}</div></div>}

    <div className="threads-grid">
      <nav className="threads-side" aria-label="Projects and threads">
        {!title && mayStart && !writing && <Button className="new-request" onClick={startNew}><Plus size={16} /> New project</Button>}
        {audience === "agency" && <label className="directive-filter">FOR<select aria-label="Show work for" value={forOrg} onChange={(e) => setForOrg(e.target.value)}>
          <option value="*">Everyone</option><option value="INTERNAL">The agency&apos;s own work</option>
          {clients.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
        <div className="desk-tabs" role="tablist">
          <Button role="tab" aria-selected={only === "all"} variant="ghost" className={only === "all" ? "tab active" : "tab"} onClick={() => setOnly("all")}>All threads</Button>
          <Button role="tab" aria-selected={only === "needs"} variant="ghost" className={only === "needs" ? "tab active" : "tab"} onClick={() => setOnly("needs")}>Needs you{needCount ? <span className="tab-count">{needCount}</span> : null}</Button>
        </div>
        {loading ? <p className="convo-sub">Loading…</p> : shownGroups.length === 0
          ? <Empty title={only === "needs" ? "Nothing needs you here." : "No projects yet."}>{only === "needs" ? "Questions and materials asked of you arrive here." : mayStart ? "Start one with New project." : null}</Empty>
          : shownGroups.map((g) => <section key={g.key} className="thread-group" aria-label={g.name}>
              <h4><span>{g.isNew ? "New project" : g.name}</span><small>{audience === "agency" ? `${forName(g.org)} · ` : ""}{g.isNew ? "being understood" : label(g.status ?? "")}</small></h4>
              {g.threads.map((t) => { const w = stateWord(t.state, needs(t), audience); return <button key={t.thread_id} type="button" className="thread-row" data-state={w.state} data-feature={t.opened_from_id ? "" : undefined} aria-current={openedId === t.thread_id || undefined} onClick={() => open(t.thread_id)}>
                <span className="tr-title">{t.opened_from_id && <CornerDownRight size={12} aria-hidden="true" />}{t.title}</span>
                <span className="tr-meta"><span className="thread-state" data-state={w.state}>{w.word}</span><small>{fmtAgo(t.updated_at)}</small></span>
                {t.last_message && <small className="tr-last">{t.last_message.text}</small>}
              </button>; })}
            </section>)}
      </nav>

      <div className="threads-main">
        {writing
          ? <>{intents.length > 0 && <Button variant="ghost" className="back-link thread-back" onClick={() => setWriting(false)}><ArrowLeft size={14} /> ALL THREADS</Button>}
              <Composer organizations={organizations} fixedOrganizationId={fixedOrganizationId} onSubmitted={sent} onClose={intents.length ? () => setWriting(false) : undefined} /></>
          : opened
            ? <ThreadDetail key={opened.t.thread_id} threadId={opened.t.thread_id} summary={opened.t} group={opened.g} audience={audience} intent={byIntent.get(opened.t.current.intent_id)} part={part} setPart={setPart}
                notice={notice && notice.id === opened.t.current.intent_id ? notice.text : null} stamp={`${stamp}:${tick}`} canWrite={canWrite} titleOf={titleOf}
                onOpenThread={(id) => open(id)} onBack={() => { setOpenId(null); setPending(null); setNotice(null); }} onChanged={reload} onStarted={sent} />
            : <div className="threads-empty"><Empty title={pending ? "Opening your request…" : "Choose a thread."}>{pending ? null : "Each project holds its threads. A feature we find in what you write opens as its own thread; something outside the project is offered as a new one."}</Empty></div>}
      </div>

      {opened && !writing && <ProjectPanel group={opened.g} openId={opened.t.thread_id} titleOf={titleOf} word={(t) => stateWord(t.state, needs(t), audience)} onOpen={(id) => open(id)} />}
    </div>
  </div>;
}

const latest = (ts: ThreadSummary[]) => ts.reduce((m, t) => (t.updated_at > m ? t.updated_at : m), "");

/** One thread: the conversation across its requests, then what its current request asks and the plan, each on its own tab. */
function ThreadDetail({ threadId, summary, group, audience, intent, part, setPart, notice, stamp, canWrite, titleOf, onOpenThread, onBack, onChanged, onStarted }: {
  threadId: string; summary: ThreadSummary; group: Group; audience: "agency" | "client"; intent: Intent | undefined; part: Part; setPart: (p: Part) => void; notice: string | null; stamp: string;
  canWrite: (i: Intent) => boolean; titleOf: (id: string | null) => string | null;
  onOpenThread: (id: string) => void; onBack: () => void; onChanged: () => void; onStarted: (s: { intentId: string; status: string }) => void;
}) {
  const ds = useDataSource();
  const [view, setView] = useState<ThreadView | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void ds.threads.read(threadId).then((r) => { if (live) setView(r.data); });
    return () => { live = false; };
  }, [ds, threadId, stamp, tick]);
  const waiting = view?.waiting_for_reply ?? false;
  useEffect(() => {
    if (!waiting) return;
    const t = window.setInterval(() => setTick((n) => n + 1), WAIT_POLL_MS);
    return () => window.clearInterval(t);
  }, [waiting]);

  const may = intent ? canWrite(intent) : false;
  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true); setMsg(null);
    const r = await ds.threads.say(threadId, text);
    setBusy(false);
    if (r.error) { setMsg(r.error.message); return; }
    setDraft("");
    if (r.data?.change_intent_id) setMsg("This thread's request is already understood, so we've taken your message as a change to the plan.");
    setTick((n) => n + 1); onChanged();
  };
  const startProject = async (s: { name: string; your_words: string }) => {
    if (!intent) return;
    setMsg(null);
    const r = await ds.intents.submit({ organizationId: intent.organization_id, text: s.your_words, attachments: [] });
    if (r.error) { setMsg(r.error.message); return; }
    onStarted({ intentId: r.data!.intentId, status: r.data!.status });
  };

  const asks = intent ? intent.questions.length + intent.materials.length + (audience === "agency" && intent.delivery?.needs_answer ? 1 : 0) : 0;
  // The plan's decision belongs to the thread the plan came from; a thread waiting its turn says so instead.
  const deciding = summary.needs_you.decision;
  const from = group.org.kind === "INTERNAL" ? "The agency's own work" : group.org.name;
  const state = view ? waitLine(view, titleOf) : null;
  const whose = may ? "you" : audience === "agency" ? "the client" : "your account owner";

  return <div className="directive-detail thread-detail">
    <Button variant="ghost" className="back-link thread-back" onClick={onBack}><ArrowLeft size={14} /> ALL THREADS</Button>
    <div className="directive-detail-head"><div>
        <small className="who">{audience === "agency" && `${from} · `}{intent ? fmtAgo(intent.created_at) : ""}{intent && audience === "agency" ? (intent.source === "CLIENT_INTENT" ? " · from the client" : " · from the agency") : ""}</small>
        <h3>{view?.title ?? intent?.text ?? ""}</h3>
        {view?.opened_from && <small className="thread-from">Opened from <button type="button" className="link-button" onClick={() => onOpenThread(view.opened_from!.thread_id)}>{view.opened_from.title ?? "another thread"}</button></small>}
      </div>
      {intent && <span className={`pill ${intentTone(intent.status)}`}>{(INTENT_STATUS_WORDS[intent.status] ?? label(intent.status)).toUpperCase()}</span>}</div>
    {notice && <p className="mmsg directive-notice" role="status">{notice}</p>}
    {state && <p className="thread-wait" role="status">{state}</p>}
    <div className="desk-tabs" role="tablist">
      {(["talk", "asks", "plan"] as const).map((t) => <Button key={t} role="tab" aria-selected={part === t} variant="ghost" className={part === t ? "tab active" : "tab"} disabled={t === "plan" && !intent?.project_id} onClick={() => setPart(t)}>
        {t === "talk" ? "Conversation" : t === "asks" ? "What it asks" : "The plan"}{t === "asks" && asks ? <span className="tab-count">{asks}</span> : null}</Button>)}
    </div>

    {part === "talk" && <section className="convo thread-convo" aria-label="Conversation in this thread">
      {(asks > 0 || deciding) && <div className="thread-asking" role="group" aria-label={`Waiting on ${whose}`}>
        {intent && intent.questions.slice(0, 3).map((q) => <button key={q.id} type="button" className="ask-chip" onClick={() => setPart("asks")}>{q.question}</button>)}
        {intent && intent.questions.length > 3 && <button type="button" className="ask-chip" onClick={() => setPart("asks")}>{intent.questions.length - 3} more question{intent.questions.length - 3 === 1 ? "" : "s"}</button>}
        {intent && intent.materials.length > 0 && <button type="button" className="ask-chip" onClick={() => setPart("asks")}>{intent.materials.length} thing{intent.materials.length === 1 ? "" : "s"} we need from {whose}</button>}
        {deciding && <button type="button" className="ask-chip" onClick={() => setPart("plan")}>The plan is ready for {may ? "your" : audience === "agency" ? "the client's" : "a"} decision</button>}
      </div>}
      {!view ? <p className="convo-sub">Loading…</p> : <ol className="convo-thread">
        {/* The thread reads as one conversation: each request made in it, then what was said, in the order it happened. */}
        {[...view.requests.map((r, n) => ({ at: r.at, request: { ...r, n } })), ...view.messages.map((m) => ({ at: m.at, message: m }))]
          .sort((a, b) => a.at.localeCompare(b.at))
          .map((x) => "request" in x && x.request
            ? <li key={`r-${x.request.intent_id}`} data-from="REQUEST"><span className="convo-who">{x.request.n === 0 ? (view.opened_from ? `In your words, from "${view.opened_from.title ?? "another thread"}"` : "The request") : "A change"}<small>{fmtAgo(x.request.at)}</small></span><p>{x.request.text}</p></li>
            : "message" in x && x.message ? <MessageItem key={x.message.id} m={x.message} canWrite={may} onOpenThread={onOpenThread} onStartProject={(s) => void startProject(s)} /> : null)}
      </ol>}
      {waiting && <p className="convo-sub" role="status">The agency will reply here.</p>}
      {msg && <p className="mmsg" role="status">{msg}</p>}
      {may && <div className="convo-write">
        <textarea aria-label="Your message" rows={2} placeholder="Ask why, correct us, or tell us more in your own words…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button disabled={busy || !draft.trim()} onClick={() => void send()}>Send</Button>
      </div>}
    </section>}

    {part === "asks" && (!intent ? <Empty title="Nothing is being asked here." />
      : audience === "agency"
        ? <IntentCard key={`${intent.id}:asks`} intent={intent} part="asks" talk={false} canAnswer={canWrite(intent)} refresh={onChanged} />
        : <ClientIntentCard key={intent.id} intent={intent} talk={false} plan={false} canAnswer={canWrite(intent)} refresh={onChanged} />)}
    {part === "plan" && (intent?.project_id
      ? <PlanPanel projectId={intent.project_id} organizationId={intent.organization_id} onChanged={onChanged} />
      : <Empty title="No plan yet.">It is written once the request is understood.</Empty>)}
  </div>;
}

/** The project a thread is in: what it is for, and its threads with where each stands, as in Claude's project view. */
function ProjectPanel({ group, openId, titleOf, word, onOpen }: { group: Group; openId: string; titleOf: (id: string | null) => string | null; word: (t: ThreadSummary) => { state: ThreadState; word: string }; onOpen: (id: string) => void }) {
  const words = group.threads.map((t) => word(t).word.toLowerCase());
  const counts = [...new Set(words)].map((w) => `${words.filter((x) => x === w).length} ${w}`);
  return <aside className="threads-project" aria-label="The project">
    <div className="eyebrow">{group.isNew ? "NEW PROJECT" : "PROJECT"}</div>
    <h4>{group.isNew ? group.threads[0]?.title ?? group.name : group.name}</h4>
    {group.isNew
      ? <p className="convo-sub">Being understood. It becomes a project once we know what it is for; its threads start then.</p>
      : group.objective && <p className="tp-objective">{group.objective}</p>}
    <div className="section-label"><span>THREADS</span><span>{group.threads.length}</span></div>
    <ul className="tp-threads">{group.threads.map((t) => <li key={t.thread_id}>
      <button type="button" className="link-button" aria-current={t.thread_id === openId || undefined} onClick={() => onOpen(t.thread_id)}>{t.title}</button>
      <span className="thread-state" data-state={word(t).state}>{word(t).word}</span>
      {waitLine(t, titleOf) && <small>{waitLine(t, titleOf)}</small>}
    </li>)}</ul>
    <small className="convo-sub">{counts.join(" · ")}</small>
  </aside>;
}
