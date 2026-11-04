"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, CircleAlert, FolderOpen, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { awaitsSignature } from "@/lib/attention";
import { useDataSource } from "@/lib/data";
import { fmtDate, label, statusTone } from "@/lib/format";
import type { OwnerData, Question, RunStatus, RunTask } from "@/lib/model";
import { PlanPanel } from "./plans";
import { DirectionsFor } from "./workshop/directions";
import { useStepUp } from "./step-up";

/**
 * The case file for a project: the work in order, how much of the approved budget it has used, what it is waiting to ask, and the
 * hand on the brake. One component for the CEO's computer and the client's room; the audience only changes the words and what
 * is shown. Nothing here decides who may do what: the API does, and its refusal is shown as it is.
 */
export type Audience = "agency" | "client";

const WHY: Record<string, string> = {
  AWAITING_APPROVAL: "your go-ahead", AWAITING_CLARIFICATION: "an answer", AWAITING_CONTEXT: "some information", AWAITING_CREDENTIAL: "access",
  POLICY_BLOCK: "a rule", NEGOTIATION_CONFLICT: "a disagreement to be settled", BUDGET_EXCEEDED: "the budget", QUALITY_BLOCK: "a quality check",
  ANOMALY: "something unexpected", HUMAN_TASK: "a person to do it", EXTERNAL_DEPENDENCY: "an outside service", PAUSED_BY_OWNER: "being resumed",
  AWAITING_CONSULTATION: "another department's review", CONSULTATION_OBJECTION: "a decision on an objection", CONSULTATION_ESCALATION: "a decision on who should review it",
  SUBSTITUTE_INVALIDATED: "a decision on the plan",
};
/**
 * Reasons that hold work until a person decides. Time passing never releases them: a review that is late is still owed, and an
 * unanswered question is never taken as a yes.
 */
const HELD_UNTIL_DECIDED = ["AWAITING_CONSULTATION", "CONSULTATION_OBJECTION", "CONSULTATION_ESCALATION", "SUBSTITUTE_INVALIDATED"];
export const whyWords = (reason: string | null) => (reason ? WHY[reason] ?? label(reason).toLowerCase() : "");

export function runWords(status: RunStatus, reason: string | null): string {
  switch (status) {
    case "RUNNING": return "UNDER WAY";
    case "WAITING": return `WAITING · ${whyWords(reason).toUpperCase()}`;
    case "PAUSED": return "PAUSED";
    case "COMPLETED": return "DONE";
    case "CANCELLED": return "STOPPED";
    case "FAILED": return "FAILED";
  }
}

function stepWords(t: RunTask): { text: string; tone: string } {
  switch (t.status) {
    case "COMPLETED": return { text: "Done", tone: "done" };
    case "RUNNING": return { text: "Under way", tone: "now" };
    case "READY": return { text: t.stale ? "Being redone" : "Ready to start", tone: "next" };
    case "PENDING": return { text: t.stale ? "Being redone, once what it depends on is ready" : "Waiting for earlier steps", tone: "later" };
    case "WAITING": case "WAITING_FOR_HUMAN": return { text: `Waiting for ${whyWords(t.wait_reason)}`, tone: "ask" };
    case "BLOCKED": return { text: heldWords(t.wait_reason), tone: "ask" };
    case "FAILED": return { text: "Stopped: something went wrong", tone: "bad" };
    case "CANCELLED": return { text: "Stopped", tone: "bad" };
  }
}

/** Why a step is held. A held step starts only once what holds it is settled; nobody can simply resume it. */
function heldWords(reason: string | null): string {
  switch (reason) {
    case "AWAITING_CONSULTATION": case "CONSULTATION_OBJECTION": case "CONSULTATION_ESCALATION":
      return "On hold: what it builds on is waiting for another department's review or a decision, and it starts only once that is settled";
    case "SUBSTITUTE_INVALIDATED":
      return "On hold: the approved file the plan relied on in place of this work can no longer be relied on, and it waits for a decision on the plan";
    default: return "Settling a problem with an earlier step";
  }
}

const money = (n: number) => `$${n.toFixed(2)}`;
const LIVE: RunStatus[] = ["RUNNING", "WAITING", "PAUSED"];

/** Run and budget for one project, shared by everything on the page that asks. */
export function useCase(projectId: string) {
  const ds = useDataSource();
  const runs = useQuery({ queryKey: ["case", projectId, "runs"], queryFn: async () => { const r = await ds.runs.list(projectId); if (r.error) throw new Error(r.error.message); return r.data!; } });
  const budget = useQuery({ queryKey: ["case", projectId, "budget"], queryFn: async () => { const r = await ds.runs.budget(projectId); if (r.error) throw new Error(r.error.message); return r.data; } });
  return { run: runs.data?.[0] ?? null, runs, budget: budget.data ?? null, loading: runs.isLoading };
}

/** A project's standing in a few words, from its work. Null before any work has begun. */
export function RunChip({ projectId }: { projectId: string }) {
  const { run } = useCase(projectId);
  return run ? <span className={`pill ${statusTone(run.status)}`}>{runWords(run.status, run.wait_reason)}</span> : null;
}

export function CaseFile({ projectId, audience, canControl, onChanged }: { projectId: string; audience: Audience; canControl: boolean; onChanged?: (() => void) | undefined }) {
  const ds = useDataSource();
  const qc = useQueryClient();
  const { run, budget, loading } = useCase(projectId);
  const [confirm, setConfirm] = useState<"pause" | "stop" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const changed = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ["case"] }), qc.invalidateQueries({ queryKey: ["questions"] })]);
    onChanged?.();
  };
  const act = async (fn: () => Promise<{ error: { message: string } | null }>, done: string) => {
    setBusy(true); setMsg(null);
    const r = await fn();
    setBusy(false);
    if (r.error) { setMsg(r.error.message); return; }
    setConfirm(null); setNote(""); setMsg(done); await changed();
  };

  if (loading) return <div className="case-file" aria-label="Case file"><p className="mmsg">Loading…</p></div>;
  if (!run) return <div className="case-file" aria-label="Case file"><p className="case-none">{audience === "client" ? "Work begins once you have approved the plan." : "No work has begun: there is no approved plan yet."}</p></div>;

  const live = LIVE.includes(run.status);
  const pct = budget?.used_percent ?? null;
  return <section className="case-file" aria-label="Case file">
    <div className="case-head"><span className={`pill ${statusTone(run.status)}`}>{runWords(run.status, run.wait_reason)}</span><small>Plan version {run.plan_version}{run.ended_at ? ` · ended ${fmtDate(run.ended_at)}` : ` · started ${fmtDate(run.started_at)}`}</small></div>

    <div className="case-budget" aria-label="Budget used">
      {budget && budget.approved_usd !== null ? <>
        <div className="case-budget-line"><b>{money(budget.used_usd)}</b> of {money(budget.approved_usd)} approved{pct !== null ? ` (${pct}%)` : ""}</div>
        <div className="case-meter" role="progressbar" aria-label="Share of the approved budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct ?? 0)}><i className={pct !== null && pct >= 100 ? "full" : pct !== null && pct >= 80 ? "high" : ""} style={{ width: `${Math.min(100, pct ?? 0)}%` }} /></div>
      </> : <div className="case-budget-line">No budget approved.</div>}
    </div>

    <ol className="case-timeline" aria-label="The work, in order">
      {run.tasks.map((t) => { const w = stepWords(t); return <li key={t.id} className={`case-step ${w.tone}`}><span className="case-dot">{w.tone === "done" ? <Check size={11} /> : w.tone === "ask" || w.tone === "bad" ? <CircleAlert size={11} /> : null}</span><span><b>{t.title}</b><small>{label(t.domain)} · {w.text}</small></span></li>; })}
    </ol>

    {canControl && live && <div className="case-controls">
      {run.status === "RUNNING" && <Button variant="outline" disabled={busy} onClick={() => setConfirm(confirm === "pause" ? null : "pause")}><Pause size={14} /> Hold the work</Button>}
      {run.status === "PAUSED" && <Button variant="outline" disabled={busy} onClick={() => act(() => ds.runs.resume(projectId), "The work has resumed.")}><Play size={14} /> Resume the work</Button>}
      <Button variant="outline" className="reject-btn" disabled={busy} onClick={() => setConfirm(confirm === "stop" ? null : "stop")}><Square size={14} /> Stop the work</Button>
      {confirm === "pause" && <div className="plan-confirm"><p>Nothing new will start. Work already under way is allowed to finish. You can resume whenever you like.</p>
        <label>Why (optional)<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <Button disabled={busy} onClick={() => act(() => ds.runs.pause(projectId, note.trim() || undefined), "The work is on hold.")}>Confirm: hold the work</Button></div>}
      {confirm === "stop" && <div className="plan-confirm"><p>This ends the work for good. What is unfinished is cancelled, nothing more will run, and what was approved stops applying.</p>
        <label>Why (optional)<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <Button className="reject-btn" disabled={busy} onClick={() => act(() => ds.runs.cancel(projectId, note.trim() || undefined), "The work has been stopped.")}>Confirm: stop the work</Button></div>}
    </div>}
    {msg && <p className="mmsg" role="status">{msg}</p>}

    <QuestionsList projectId={projectId} audience={audience} onChanged={onChanged} quiet />
  </section>;
}

/* ---- Questions from the work ---- */

const OPTION: Record<string, string> = {
  APPROVE: "Approve this step", GRANT_EXCEPTION: "Grant an exception", RAISE_BUDGET: "Raise the budget", REWORK: "Do it again", ACCEPT_RISK: "Accept it anyway",
  RETRY: "Try again", MARK_DONE: "It is done", RESUME: "Resume the work", UPSTREAM_STANDS: "Keep the earlier result", CONSTRAINT_STANDS: "Redo the earlier result", STOP_RUN: "Stop the work",
  OUTPUT_STANDS: "Let the work stand over the objection", REDO_OUTPUT: "Redo the work", REQUEST_QUALIFIED_REVIEW: "Ask a qualified reviewer", REVISE_PLAN: "Revise the plan",
};
const optionWords = (o: string) => OPTION[o] ?? label(o);
/** Answers that ask their own question in place of the optional note. */
const NOTE_ASKED = ["RAISE_BUDGET", "MARK_DONE", "ACCEPT_RISK", "OUTPUT_STANDS", "REQUEST_QUALIFIED_REVIEW"];

export function QuestionsList({ projectId, audience, onChanged, quiet }: { projectId?: string | undefined; audience: Audience; onChanged?: (() => void) | undefined; quiet?: boolean | undefined }) {
  const ds = useDataSource();
  const q = useQuery({ queryKey: ["questions", projectId ?? "all"], queryFn: async () => { const r = await ds.questions.list(projectId ? { projectId } : undefined); if (r.error) throw new Error(r.error.message); return r.data!; } });
  const items = q.data ?? [];
  if (q.isLoading) return null;
  if (!items.length) return quiet ? null : <p className="case-none">Nothing is waiting for an answer.</p>;
  return <div className="questions" aria-label="Questions from the work">{items.map((x) => <QuestionCard key={x.id} question={x} audience={audience} onChanged={onChanged} />)}</div>;
}

export function QuestionCard({ question: x, audience, onChanged }: { question: Question; audience: Audience; onChanged?: (() => void) | undefined }) {
  const ds = useDataSource();
  const qc = useQueryClient();
  const [choice, setChoice] = useState<string | null>(null);
  const chosen = x.options.find((o) => o.id === choice) ?? null;
  const held = HELD_UNTIL_DECIDED.includes(x.reason);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { guard, panel: stepUpPanel } = useStepUp();

  const askedOf = audience === "client" ? null : x.routed_to === "CEO" ? "Asked of you." : "Asked of the client's owner. You can answer for them only if they have allowed it.";
  const confirm = async () => {
    if (!choice) return;
    setBusy(true); setMsg(null);
    await guard(() => ds.questions.answer(x.id, { option: choice, ...(note.trim() ? { note: note.trim() } : {}), ...(choice === "RAISE_BUDGET" ? { toUsd: Number(amount) } : {}), ...(choice === "MARK_DONE" ? { evidence: note.trim() } : {}) }), async (r) => {
      setBusy(false);
      if (r.error) { setMsg(r.error.message); return; }
      setChoice(null); setNote(""); setAmount("");
      await Promise.all([qc.invalidateQueries({ queryKey: ["questions"] }), qc.invalidateQueries({ queryKey: ["case"] })]);
      onChanged?.();
    });
    setBusy(false);
  };

  return <article className="question" aria-label={x.title}>
    <div className="question-head"><b>{x.title}</b><small>{audience === "agency" ? `${label(x.reason)} · ` : ""}{x.deadline && x.reason !== "PAUSED_BY_OWNER" ? `answer by ${fmtDate(x.deadline)}` : x.status === "EXPIRED" ? (held ? "overdue · the work stays on hold until it is answered" : "overdue") : ""}</small></div>
    <p className="question-summary">{x.summary}</p>
    <DirectionsFor projectId={x.project_id} onChosen={onChanged} />
    {audience === "agency" && x.detail && <p className="question-detail">{x.detail}</p>}
    {askedOf && <small className="question-asked">{askedOf}</small>}
    <div className="question-options" role="group" aria-label="Answers">
      {x.options.map(({ id: o }) => <Button key={o} variant={o === "STOP_RUN" ? "outline" : "ghost"} className={`${o === "STOP_RUN" ? "reject-btn " : ""}${choice === o ? "chosen" : ""}`} aria-pressed={choice === o} onClick={() => { setChoice(choice === o ? null : o); setMsg(null); }}>
        {optionWords(o)}{x.recommendation?.option === o ? <em className="recommended"> · RECOMMENDED</em> : null}</Button>)}
    </div>
    {x.recommendation && <small className="question-why">{x.recommendation.why}</small>}
    {choice && <div className="plan-confirm">
      {choice === "RAISE_BUDGET" && <label>Raise the budget to (US dollars)<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>}
      {choice === "MARK_DONE" && <label>What was done?<textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>}
      {choice === "ACCEPT_RISK" && <label>Why is this acceptable? It is recorded with your name.<textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>}
      {choice === "OUTPUT_STANDS" && <label>Why should the work stand? It is recorded with your name.<textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>}
      {choice === "REQUEST_QUALIFIED_REVIEW" && <label>Who is qualified to review it, and why?<textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>}
      {!NOTE_ASKED.includes(choice) && <label>Add a note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} /></label>}
      {choice === "STOP_RUN" && <p>This ends the work for good.</p>}
      {chosen?.stepUp && <small className="plan-confirm-note">For safety we will ask you for a six-digit code, which we email to you.</small>}
      <Button className={choice === "STOP_RUN" ? "reject-btn" : "approve-btn"} disabled={busy} onClick={confirm}>Confirm: {optionWords(choice).toLowerCase()}</Button>
      {stepUpPanel}
    </div>}
    {msg && <p className="mmsg" role="status">{msg}</p>}
  </article>;
}

/* ---- Where it appears in the agency ---- */

/** A project's standing: what its work is doing if there is work, otherwise what the project itself says. */
export function Standing({ projectId, fallback }: { projectId: string; fallback: { text: string; tone: string } }) {
  const { run } = useCase(projectId);
  return run ? <span className={`pill ${statusTone(run.status)}`}>{runWords(run.status, run.wait_reason)}</span> : <span className={`pill ${fallback.tone}`}>{fallback.text}</span>;
}

/** On the computer: a dossier's case file, opened and closed in place. */
export function CaseFileToggle({ projectId, name, audience, canControl }: { projectId: string; name: string; audience: Audience; canControl: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="ghost" size="icon" className="icon-button" aria-label={`${open ? "Close" : "Open"} case file for ${name}`} aria-expanded={open} onClick={() => setOpen(!open)}><FolderOpen size={17} /></Button>
    {open && <div className="case-slot"><CaseFile projectId={projectId} audience={audience} canControl={canControl} /></div>}
  </>;
}

/** On the contracts desk: what the work is asking, and the plans waiting for a signature. */
export function ContractsDesk({ data, onChanged }: { data: OwnerData; onChanged: () => void }) {
  const planned = data.intents.filter(awaitsSignature);
  const name = (pid: string | null) => data.projects.find((p) => p.id === pid)?.name ?? "";
  return <div className="contracts-desk">
    <div className="section-label"><span>QUESTIONS FROM THE WORK</span></div>
    <QuestionsList audience="agency" onChanged={onChanged} />
    <div className="section-label"><span>PLANS AWAITING A SIGNATURE</span><span>{planned.length}</span></div>
    {planned.length === 0 ? <p className="case-none">No plan is waiting for a decision.</p> : planned.map((i) => <div key={i.id} className="desk-plan"><small className="who">{name(i.project_id)}</small><PlanPanel projectId={i.project_id!} organizationId={i.organization_id} onChanged={onChanged} /></div>)}
  </div>;
}

/** On the phone: the questions that need a person, most pressing first. */
export function PhoneQuestions({ open }: { open: (projectId?: string) => void }) {
  const ds = useDataSource();
  const q = useQuery({ queryKey: ["questions", "all"], queryFn: async () => { const r = await ds.questions.list(); if (r.error) throw new Error(r.error.message); return r.data!; } });
  const items = q.data ?? [];
  return <>
    <div className="phone-section-title small-title">Questions From The Work <span>{String(items.length).padStart(2, "0")}</span></div>
    {items.length === 0 ? <div className="phone-info"><Check size={15} /><span>Nothing is waiting<small>All work is moving or finished</small></span></div> :
      items.slice(0, 3).map((x) => <Button key={x.id} variant="ghost" className="phone-decision" onClick={() => open(x.project_id)}><span>{x.title}<small>{label(x.reason)}{x.routed_to === "CLIENT_OWNER" ? " · asked of the client" : ""}</small></span><ArrowRight size={16} /></Button>)}
  </>;
}

/** In the client's room: a project, with its progress a click away. */
export function ProjectRoom({ project, canControl }: { project: { id: string; name: string; objective: string | null; description: string | null; status: string }; canControl: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="resolved-row project-room">
    <span>{project.name}<small>{project.objective ?? project.description ?? ""}</small></span>
    <span className="project-room-actions"><Standing projectId={project.id} fallback={{ text: label(project.status).toUpperCase(), tone: statusTone(project.status) }} />
      <Button variant="ghost" className="inline-arrow" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} progress of ${project.name}`} onClick={() => setOpen(!open)}>{open ? "HIDE PROGRESS" : "SEE PROGRESS"}</Button></span>
    {open && <div className="case-slot"><CaseFile projectId={project.id} audience="client" canControl={canControl} /></div>}
  </div>;
}
