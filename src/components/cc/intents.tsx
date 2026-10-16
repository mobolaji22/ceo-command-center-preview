"use client";

import { useEffect, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import type { NewAttachment } from "@/lib/data/types";
import type { Asset, ClientIntentView, Intent, MaterialWay } from "@/lib/model";
import { fmtAgo, label, statusTone } from "@/lib/format";
import { Empty } from "./views";
import { PlanPanel } from "./plans";

const STATUS_WORDS: Record<string, string> = {
  RECEIVED: "Received", CLARIFYING: "Needs answers", AWAITING_REASONING: "Waiting for reasoning", UNDERSTOOD: "Understood", PLANNED: "Planned", REJECTED: "Withdrawn", SUPERSEDED: "Replaced", PROPOSED: "Proposed",
};
const tone = (status: string) => (status === "CLARIFYING" ? "amber" : status === "UNDERSTOOD" || status === "PLANNED" ? "green" : "muted");

type Org = { id: string; name: string };

/**
 * Where a request begins: say what you want, attach what helps. Nothing here creates a project; the request is understood,
 * questions come back if needed, and the project opens when it is understood.
 */
export function Composer({ organizations, fixedOrganizationId, onSubmitted }: { organizations: Org[]; fixedOrganizationId?: string | undefined; onSubmitted: () => void }) {
  const ds = useDataSource();
  const [text, setText] = useState("");
  const [orgId, setOrgId] = useState(fixedOrganizationId ?? "");
  const [items, setItems] = useState<NewAttachment[]>([]);
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const organizationId = fixedOrganizationId ?? orgId;

  const submit = async () => {
    if (!organizationId) { setMsg("Choose which client this is for."); return; }
    setBusy(true); setMsg(null);
    const r = await ds.intents.submit({ organizationId, text: text.trim(), attachments: items });
    setBusy(false);
    if (r.error || !r.data) { setMsg(r.error?.message ?? "Couldn't send that."); return; }
    setText(""); setItems([]);
    setMsg(r.data.status === "UNDERSTOOD" || r.data.status === "PLANNED" ? "Understood. A plan is being prepared for your approval." : r.data.status === "CLARIFYING" ? "Received. A few questions below will make it sharper." : "Received.");
    onSubmitted();
  };

  return <div className="directive-form" aria-label="New request">
    <label htmlFor="request-text">WHAT WOULD YOU LIKE DONE?</label>
    <textarea id="request-text" value={text} maxLength={8000} onChange={(e) => setText(e.target.value)} placeholder="Describe the outcome you want, who it is for, and by when. Attach anything that helps." />
    {!fixedOrganizationId && <div className="directive-targets"><label>CLIENT<select value={orgId} onChange={(e) => setOrgId(e.target.value)}><option value="">Choose…</option>{organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label></div>}
    {items.length > 0 && <div className="chips">{items.map((a, i) => <span key={i} className="chip">{a.kind === "file" ? a.file.name : a.url}
      <select aria-label="Where it goes" value={a.scope} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, scope: e.target.value as "PROJECT" | "ORGANIZATION" } : x)))}><option value="PROJECT">This project</option><option value="ORGANIZATION">Library</option></select>
      <button aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))}><X size={12} /></button></span>)}</div>}
    <div className="directive-targets">
      <label className="attach"><Paperclip size={14} /> Attach a file<input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) setItems([...items, { kind: "file", file: f, scope: "PROJECT" }]); e.target.value = ""; }} /></label>
      <label>OR PASTE A LINK<input placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && link.trim()) { e.preventDefault(); setItems([...items, { kind: "link", url: link.trim(), scope: "PROJECT" }]); setLink(""); } }} /></label>
      <Button type="button" variant="outline" disabled={!link.trim()} onClick={() => { setItems([...items, { kind: "link", url: link.trim(), scope: "PROJECT" }]); setLink(""); }}>Add link</Button>
    </div>
    <div className="directive-footer"><span role="status">{msg ?? `${text.length} characters`}</span><Button className="approve-btn" disabled={busy || !text.trim()} onClick={submit}>{busy ? "Sending…" : "Send request"} <Send size={15} /></Button></div>
  </div>;
}

/**
 * One request: where it stands and what is being asked back. The questions and the materials list are one ask; answering
 * is for the people who may (a client's owner for their own requests, the agency for its own).
 */
export function IntentCard({ intent, canAnswer, refresh }: { intent: Intent; canAnswer: boolean; refresh: () => void }) {
  const ds = useDataSource();
  const [msg, setMsg] = useState<string | null>(null);
  const [text, setText] = useState<Record<string, string>>({});
  const run = async (fn: () => Promise<{ error: { message: string } | null }>, done: string) => {
    setMsg(null);
    const r = await fn();
    if (r.error) { setMsg(r.error.message); return; }
    setMsg(done); refresh();
  };
  const open = intent.status === "CLARIFYING" || intent.status === "UNDERSTOOD" || intent.status === "PLANNED";

  return <div className="intent-card" data-status={intent.status}>
    <div className="resolved-row intent-head"><span>{intent.text}<small>{fmtAgo(intent.created_at)}{intent.source === "CEO_DIRECTIVE" ? " · from the agency" : ""}</small></span><span className={`pill ${tone(intent.status)}`}>{(STATUS_WORDS[intent.status] ?? label(intent.status)).toUpperCase()}</span></div>
    {msg && <p className="mmsg" role="status">{msg}</p>}

    {intent.questions.length > 0 && <div className="ask-block"><div className="section-label"><span>QUESTIONS</span><span>{intent.questions.length}</span></div>
      {intent.questions.map((q) => <div key={q.id} className="question" aria-label={q.question}>
        <b>{q.question}</b><small>{q.why} Changes: {q.decision}</small>
        {canAnswer ? <div className="options">{q.options.map((o) => <Button key={o.id} variant="outline" className="option" onClick={() => run(() => ds.intents.answer(intent.id, q.id, { optionId: o.id }), "Thank you.")}>{o.label}<small>{o.tradeoff}</small></Button>)}
          <div className="free"><input aria-label="Something else" placeholder="Something else…" value={text[q.id] ?? ""} onChange={(e) => setText({ ...text, [q.id]: e.target.value })} />
            <Button variant="ghost" disabled={!(text[q.id] ?? "").trim()} onClick={() => run(() => ds.intents.answer(intent.id, q.id, { text: (text[q.id] ?? "").trim() }), "Thank you.")}>Send</Button>
            {q.default_option_id && <Button variant="ghost" onClick={() => run(() => ds.intents.answer(intent.id, q.id, { useDefault: true }), "We will go with our usual choice.")}>You decide</Button>}</div></div>
          : <small>Waiting for {intent.source === "CLIENT_INTENT" ? "the account owner" : "the agency"} to answer.</small>}
      </div>)}</div>}

    {intent.materials.length > 0 && <div className="ask-block"><div className="section-label"><span>WHAT WE NEED FROM YOU</span><span>{intent.materials.length}</span></div>
      {intent.materials.map((m) => <Material key={m.requirement_id} item={m} organizationId={intent.organization_id} canAnswer={canAnswer} onDone={(done) => { setMsg(done); refresh(); }} onError={setMsg} />)}</div>}

    {open && intent.assumptions.length > 0 && <div className="ask-block"><div className="section-label"><span>WE ASSUMED</span><span>{intent.assumptions.length}</span></div>
      {intent.assumptions.map((a) => <div key={a.id} className="resolved-row"><span>{a.question}<small>We are going with: {a.assumed}{a.forced ? " (we ran out of questions on this one, so please check it)" : ""}</small></span></div>)}</div>}

    {(intent.status === "UNDERSTOOD" || intent.status === "PLANNED") && intent.questions.length === 0 && intent.materials.length === 0 && <p className="mmsg">Nothing more is needed from you right now.</p>}

    {intent.project_id && (intent.status === "PLANNED" || intent.status === "UNDERSTOOD") && <PlanPanel projectId={intent.project_id} organizationId={intent.organization_id} onChanged={refresh} />}
  </div>;
}

/**
 * One request as its client reads it (P6.20): where it stands in one line, then the one question to answer now (with its place
 * in the round), what we need from them (required first, the rest folded), and what we assumed; the plan when there is one.
 * It renders v4's client view as it is (INV-27): the order and what is left out are decided there.
 */
export function ClientIntentCard({ intent, canAnswer, refresh }: { intent: Intent; canAnswer: boolean; refresh: () => void }) {
  const ds = useDataSource();
  const [view, setView] = useState<ClientIntentView | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void ds.intents.clientView(intent.id).then((r) => { if (live) setView(r.data); });
    return () => { live = false; };
  }, [ds, intent.id, intent.status, tick]);
  const reload = () => { setTick((n) => n + 1); refresh(); };
  const answer = async (a: { optionId?: string; text?: string; useDefault?: boolean }, done: string) => {
    if (!view?.questions[0]) return;
    setMsg(null);
    const r = await ds.intents.answer(intent.id, view.questions[0].id, a);
    if (r.error) { setMsg(r.error.message); return; }
    setMsg(done); setText(""); reload();
  };
  if (!view) return <div className="intent-card cv" data-status={intent.status}><p className="cv-sub">Loading…</p></div>;
  const q = view.questions[0];

  return <div className="intent-card cv" data-status={intent.status}>
    <div className="cv-head" data-stage={view.status.kind}>
      <p className="cv-status" role="status">{view.status.line}</p>
      <p className="cv-request">“{view.text}”<span className="cv-sub"> · {fmtAgo(view.created_at)}</span></p>
    </div>
    {msg && <p className="mmsg" role="status">{msg}</p>}

    {q && <div className="cv-question" aria-label={q.question}>
      <span className="cv-k">Question {q.position} of {q.of}</span>
      <h3>{q.question}</h3>
      <p className="cv-sub">{q.why}</p>
      {canAnswer ? <>
        <div className="cv-options">{q.options.map((o) => <Button key={o.id} variant="outline" className="cv-option" onClick={() => void answer({ optionId: o.id }, "Thank you.")}>{o.label}<small>{o.tradeoff}</small></Button>)}</div>
        <div className="cv-free"><input aria-label="Something else" placeholder="Something else…" value={text} onChange={(e) => setText(e.target.value)} />
          <Button variant="ghost" disabled={!text.trim()} onClick={() => void answer({ text: text.trim() }, "Thank you.")}>Send</Button>
          {q.default_option_id && <Button variant="ghost" onClick={() => void answer({ useDefault: true }, "We will go with our usual choice.")}>You decide</Button>}</div>
      </> : <p className="cv-sub">Waiting for the account owner to answer.</p>}
    </div>}

    {view.needs.required.length > 0 && <div className="cv-block"><h4>What we need from you</h4>
      {view.needs.required.map((m) => <Material key={m.requirement_id} item={{ ...m, required: true }} organizationId={intent.organization_id} canAnswer={canAnswer} onDone={(done) => { setMsg(done); reload(); }} onError={setMsg} />)}</div>}
    {view.needs.optional.length > 0 && <details className="cv-more"><summary>Helpful if you have them ({view.needs.optional.length})</summary>
      {view.needs.optional.map((m) => <Material key={m.requirement_id} item={{ ...m, required: false }} organizationId={intent.organization_id} canAnswer={canAnswer} onDone={(done) => { setMsg(done); reload(); }} onError={setMsg} />)}</details>}

    {/* Once there is a plan, it states what was assumed; saying it twice would only make the page longer. */}
    {!view.plan && view.assumed.length > 0 && <div className="cv-block"><h4>What we assumed</h4>
      <ul>{view.assumed.map((a) => <li key={a.id}>{a.question}<span className="cv-sub"> · We are going with: {a.answer}</span></li>)}</ul></div>}

    {view.plan && intent.project_id && <PlanPanel projectId={intent.project_id} organizationId={intent.organization_id} onChanged={reload} />}
  </div>;
}

/** A client's requests, each as they read it. */
export function ClientIntentList({ intents, canAnswer, refresh, empty }: { intents: Intent[]; canAnswer: (i: Intent) => boolean; refresh: () => void; empty: string }) {
  if (intents.length === 0) return <Empty title={empty} />;
  return <div className="intent-list">{intents.map((i) => <ClientIntentCard key={i.id} intent={i} canAnswer={canAnswer(i)} refresh={refresh} />)}</div>;
}

function Material({ item, organizationId, canAnswer, onDone, onError }: { item: Intent["materials"][number]; organizationId: string; canAnswer: boolean; onDone: (m: string) => void; onError: (m: string) => void }) {
  const ds = useDataSource();
  const [url, setUrl] = useState("");
  const [connectors, setConnectors] = useState<Asset[]>([]);
  const [pick, setPick] = useState("");
  const can = (w: MaterialWay) => item.ways.includes(w);
  useEffect(() => {
    if (!canAnswer || !can("CONNECT")) return;
    void ds.assets.list({ organizationId }).then((r) => setConnectors((r.data ?? []).filter((a) => a.kind === "CONNECTOR" || a.kind === "CREDENTIAL_POINTER")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds, organizationId, canAnswer]);
  const go = async (answer: Parameters<typeof ds.intents.respond>[1], done: string) => {
    const r = await ds.intents.respond(item.requirement_id, answer, organizationId);
    if (r.error) onError(r.error.message); else onDone(done);
  };

  return <div className="material" aria-label={item.name}>
    <span><b>{item.name}</b>{item.required && <em className="req"> required</em>}<small>{item.why} Without it: {item.if_missing}</small>{item.sourcing && <small>We are sourcing this for you.</small>}</span>
    {canAnswer && <div className="material-actions">
      {can("UPLOAD") && <label className="attach">Upload<input type="file" aria-label={`Upload for ${item.name}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) void go({ action: "UPLOAD", file: f }, `Thanks, we have ${item.name.toLowerCase()}.`); e.target.value = ""; }} /></label>}
      {can("LINK") && <span className="free"><input aria-label={`Link for ${item.name}`} placeholder="Paste a link…" value={url} onChange={(e) => setUrl(e.target.value)} /><Button variant="ghost" disabled={!url.trim()} onClick={() => void go({ action: "LINK", url: url.trim() }, "Link received.")}>Add</Button></span>}
      {can("CONNECT") && (connectors.length > 0
        ? <span className="free"><select aria-label={`Connection for ${item.name}`} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Choose a connection…</option>{connectors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Button variant="ghost" disabled={!pick} onClick={() => void go({ action: "CONNECT", assetId: pick }, "Connected.")}>Connect</Button></span>
        : <small>Add a connection in your library first.</small>)}
      {can("NONE") && <Button variant="ghost" onClick={() => void go({ action: "NONE" }, "Noted: we will proceed without it.")}>I don&apos;t have this</Button>}
      {can("SOURCE") && !item.sourcing && <Button variant="ghost" onClick={() => void go({ action: "SOURCE" }, "We will source it.")}>Please source it</Button>}
    </div>}
  </div>;
}

/** A list of requests with their asks. */
export function IntentList({ intents, canAnswer, refresh, empty }: { intents: Intent[]; canAnswer: (i: Intent) => boolean; refresh: () => void; empty: string }) {
  if (intents.length === 0) return <Empty title={empty} />;
  return <div className="intent-list">{intents.map((i) => <IntentCard key={i.id} intent={i} canAnswer={canAnswer(i)} refresh={refresh} />)}</div>;
}

export { statusTone };
