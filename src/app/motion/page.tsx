"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, Check, Link2, Minus, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton, Meter, Presence, Ring, RollingNumber, SlideGroup, Tick, confirm } from "@/components/cc/motion";
import { carry, setMotionPref, useMotionPref } from "@/lib/motion";
import "./preview.css";

/**
 * The motion preview: every small answer the Command Center gives to a change of state, on one page, with nothing behind it.
 * It reads no records and calls nothing (the waits below are timers standing in for v4), so the feel of each piece can be
 * judged and tuned before it is wired into a real screen. The pieces themselves are in src/components/cc/motion.
 */

const wait = (ms: number) => new Promise<void>((done) => window.setTimeout(done, ms));
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TABS = ["Cases & Engagements", "Decision Ledger", "Security/Gov"] as const;
const PARTS = [{ id: "talk", label: "Conversation" }, { id: "asks", label: "What it asks" }, { id: "plan", label: "The plan" }] as const;
const STEPS = ["Understand the request", "Research the market", "Draw three directions", "Build the chosen one"];
const QUEUE = [
  { id: "a1", title: "Approve the homepage direction", project: "Hearth & Crumb" },
  { id: "a2", title: "Release the research budget", project: "Aromatherapy store" },
  { id: "a3", title: "Sign the build plan, version 2", project: "Loan platform" },
  { id: "a4", title: "Publish the brand book", project: "Hearth & Crumb" },
];
const DOSSIERS = [
  { id: "d1", name: "Hearth & Crumb", line: "Design · Content · Priority 2", note: "The homepage direction is chosen; the build starts once the plan is signed." },
  { id: "d2", name: "Aromatherapy store", line: "Market · Brand · Priority 1", note: "Research is under way. Two questions wait on the client." },
  { id: "d3", name: "Loan platform", line: "Engineering · Compliance · Priority 3", note: "Version 2 of the plan adds the obligations screen before go-live." },
];

function Card({ n, title, job, children }: { n: string; title: string; job: string; children: React.ReactNode }) {
  return <section className="mo-card"><header><span className="mo-n">{n}</span><div><h2>{title}</h2><p>{job}</p></div></header><div className="mo-body">{children}</div></section>;
}

export default function MotionPreview() {
  const pref = useMotionPref();

  const [waiting, setWaiting] = useState(3);
  const [spend, setSpend] = useState(1284.5);
  const [tab, setTab] = useState<string>(TABS[0]);
  const [part, setPart] = useState<string>("talk");
  const [used, setUsed] = useState(35);
  const [done, setDone] = useState<number[]>([0]);
  const [queue, setQueue] = useState(QUEUE);
  const [made, setMade] = useState(0);
  const [replying, setReplying] = useState(false);
  const [replies, setReplies] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);

  const toggleStep = (i: number) => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
  const ask = async () => { setReplying(true); await wait(2600); setReplying(false); setReplies((n) => n + 1); };
  const dossier = DOSSIERS.find((d) => d.id === open);

  return <main className="command-center mo">
    <header className="mo-head">
      <div>
        <div className="eyebrow gold"><span className="short-line" /> MOTION PREVIEW</div>
        <h1>The small answers<span className="period">.</span></h1>
        <p>Nine things the Command Center will do when something changes. Press everything. Nothing here touches real records.</p>
      </div>
      <SlideGroup active={pref} variant="pill" className="mo-seg" role="group" aria-label="Motion">
        <Button variant="ghost" aria-pressed={pref === "system"} onClick={() => setMotionPref("system")}>Follow my device</Button>
        <Button variant="ghost" aria-pressed={pref === "off"} onClick={() => setMotionPref("off")}>Motion off</Button>
      </SlideGroup>
    </header>

    <div className="mo-grid">
      <Card n="01" title="Numbers that roll" job="A count or a total turns to its new value, so you see that it changed and which way.">
        <div className="mo-figure"><span className="mo-big"><RollingNumber value={waiting} /></span><span className="mo-cap">AWAITING SIGNATURE</span>
          <span className="mo-steps"><Button variant="outline" size="icon" aria-label="One fewer" disabled={waiting === 0} onClick={() => setWaiting((n) => Math.max(0, n - 1))}><Minus /></Button><Button variant="outline" size="icon" aria-label="One more" onClick={() => setWaiting((n) => n + 1)}><Plus /></Button></span></div>
        <div className="mo-figure"><span className="mo-big"><RollingNumber value={money(spend)} /></span><span className="mo-cap">SPENT THIS MONTH</span>
          <span className="mo-steps"><Button variant="outline" onClick={() => setSpend((n) => n + 86.75)}>Record a run</Button></span></div>
      </Card>

      <Card n="02" title="A highlight that slides" job="The mark travels from the old choice to the new one, so your eye is carried to where you now are.">
        <SlideGroup active={tab} className="computer-tabs mo-tabs" role="tablist">
          {TABS.map((t) => <Button key={t} role="tab" aria-selected={tab === t} variant="ghost" className={tab === t ? "tab active" : "tab"} onClick={() => setTab(t)}>{t}</Button>)}
        </SlideGroup>
        <p key={tab} className="mo-pane rise-in">{tab === TABS[0] ? "Three projects in motion." : tab === TABS[1] ? "Twelve decisions on record, each traceable." : "Protocol active. Nothing out of order."}</p>
        <SlideGroup active={part} variant="pill" className="mo-chips" role="group" aria-label="Part of the thread">
          {PARTS.map((p) => <Button key={p.id} variant="ghost" className="desk-chip" aria-pressed={part === p.id} onClick={() => setPart(p.id)}>{p.label}</Button>)}
        </SlideGroup>
      </Card>

      <Card n="03" title="A button that reports" job="It says it is working, then that it is done, or why not. Done is shown only when the answer has come back.">
        <div className="mo-row">
          <ActionButton className="approve-btn" doneLabel="Approved" workingLabel="Approving" run={() => wait(1400)}><Check size={16} /> Approve authorization</ActionButton>
          <ActionButton variant="outline" doneLabel="Sent" workingLabel="Sending" run={() => wait(900)}><Send size={15} /> Send</ActionButton>
        </div>
        <div className="mo-row">
          <ActionButton variant="outline" doneLabel="Signed" workingLabel="Signing" onFailed={setRefused} run={async () => { setRefused(null); await wait(1100); return { error: "The agency did not answer. Nothing was signed; try again." }; }}>Sign (this one fails)</ActionButton>
          {refused ? <span key={refused} className="mo-hint mo-refused rise-in" role="alert">{refused}</span> : <span className="mo-hint">A failure shakes once, keeps the button as it was, and says why.</span>}
        </div>
      </Card>

      <Card n="04" title="Bars and rings that fill" job="Progress and budget ease to their new level instead of jumping, and change colour near a limit.">
        <div className="mo-meter"><div className="mo-meter-top"><span className="mo-cap">SHARE OF THE APPROVED BUDGET USED</span><b><RollingNumber value={`${used}%`} /></b></div>
          <Meter value={used} label="Share of the approved budget used" tone={used >= 100 ? "full" : used >= 80 ? "high" : undefined} />
          <div className="mo-row"><Button variant="outline" onClick={() => setUsed((n) => Math.min(100, n + 25))}>Use more</Button><Button variant="ghost" onClick={() => setUsed(10)}>Start over</Button></div></div>
        <div className="mo-ring"><Ring value={(done.length / STEPS.length) * 100} label="Steps finished"><b><RollingNumber value={done.length} /></b></Ring><span>of {STEPS.length} steps finished<small>Tick the steps in the next card.</small></span></div>
      </Card>

      <Card n="05" title="Checks that land" job="A finished step gets a drawn tick and a line through it. One small moment of satisfaction per screen.">
        <ul className="mo-checks">{STEPS.map((s, i) => { const on = done.includes(i); return <li key={s}><button type="button" role="checkbox" aria-checked={on} onClick={() => toggleStep(i)}><span className="mo-box" data-on={on || undefined}>{on && <Tick size={13} />}</span><span className="strike" data-done={on || undefined}>{s}</span></button></li>; })}</ul>
      </Card>

      <Card n="06" title="Lists that close ranks" job="When an item is dealt with it leaves, and the rest slide up to take its place. A new one arrives at the foot.">
        <div className="section-label"><span>WAITING ON YOU</span><span><RollingNumber value={String(queue.length).padStart(2, "0")} /></span></div>
        <ul className="mo-queue">{queue.map((a) => <li key={a.id} style={{ viewTransitionName: `q-${a.id}` }}><div><b>{a.title}</b><small>{a.project}</small></div>
          <ActionButton size="sm" className="approve-btn" doneLabel="Approved" workingLabel="Approving" stay run={() => wait(800)} onDone={() => carry(() => flushSync(() => setQueue((q) => q.filter((x) => x.id !== a.id))))}>Approve</ActionButton></li>)}
          {queue.length === 0 && <li className="mo-empty rise-in">Nothing waits on you.</li>}</ul>
        <Button variant="ghost" className="inline-arrow" onClick={() => carry(() => flushSync(() => { setMade((n) => n + 1); setQueue((q) => [...q, { id: `n${made}`, title: "Review the proposal draft", project: "A new prospect" }]); }))}><Plus size={14} /> A NEW ONE ARRIVES</Button>
      </Card>

      <Card n="07" title="Someone is at work" job="While the agency writes its reply, the thread shows it, so a wait reads as work and not as a stall.">
        <div className="mo-thread">
          <p className="mo-msg mine">Can the homepage carry the seasonal menu?</p>
          {Array.from({ length: replies }, (_, i) => <p key={i} className="mo-msg rise-in">Yes. It fits under the hero as a short band, and it can be switched off out of season.</p>)}
          {replying && <Presence label="The agency is writing" className="rise-in" />}
        </div>
        <Button variant="outline" disabled={replying} onClick={() => void ask()}>Ask again</Button>
      </Card>

      <Card n="08" title="A word that it was done" job="Small things (a copy, a save) are confirmed in one quiet line at the foot of the screen, then it leaves.">
        <div className="mo-row">
          <Button variant="outline" onClick={() => confirm("Link copied")}><Link2 size={15} /> Copy the link</Button>
          <Button variant="outline" onClick={() => confirm("Saved to the project")}>Save</Button>
        </div>
        <span className="mo-hint">Anything that matters reports on its own button instead (card 03).</span>
      </Card>

      <Card n="09" title="One thing becomes the next" job="A row grows into the page it opens, and folds back into its row, so you never lose where you came from.">
        {!dossier ? <div className="dossier-list mo-dossiers">{DOSSIERS.map((d, i) => <button type="button" key={d.id} className="mo-dossier" style={{ viewTransitionName: `dossier-${d.id}` }} onClick={() => carry(() => flushSync(() => setOpen(d.id)))}><span className="row-index">{String(i + 1).padStart(2, "0")}</span><span><b style={{ viewTransitionName: `dossier-name-${d.id}` }}>{d.name}</b><small>{d.line}</small></span></button>)}</div>
          : <article className="mo-detail" style={{ viewTransitionName: `dossier-${dossier.id}` }}><Button variant="ghost" className="back-link" onClick={() => carry(() => flushSync(() => setOpen(null)))}><ArrowLeft size={15} /> BACK TO THE LIST</Button><h3 style={{ viewTransitionName: `dossier-name-${dossier.id}` }}>{dossier.name}</h3><small>{dossier.line}</small><p>{dossier.note}</p></article>}
      </Card>
    </div>
  </main>;
}
