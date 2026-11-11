"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import type { GuideStep, GuideStepState, PersonGuide, Question } from "@/lib/model";

/**
 * A person's step's guide (v4 ADR-0071): each step with how to approach it, what done looks like, what to watch out for and its
 * sources, what the person has logged, and how far the work has got. Whoever does the step logs each one here; "It is done" is
 * refused until every step is finished, so this is where the work is shown as it goes.
 */
const STATE_TAG: Record<GuideStepState | "TODO", string> = { TODO: "TO DO", DONE: "DONE", STUCK: "STUCK", SKIPPED: "SKIPPED" };
const PROOF_ASK = { NONE: null, NOTE: "Say what was done", LINK: "A link that shows it (https)", FILE: "A file that shows it" } as const;

export const progressLine = (p: PersonGuide["progress"]) =>
  `${p.finished} of ${p.total} steps done${p.stuck ? ` · ${p.stuck} stuck` : ""}`;

export function useGuide(question: Pick<Question, "id" | "reason">) {
  const ds = useDataSource();
  return useQuery({
    queryKey: ["guide", question.id],
    enabled: question.reason === "HUMAN_TASK",
    queryFn: async () => { const r = await ds.questions.guide(question.id); if (r.error) throw new Error(r.error.message); return r.data; },
  });
}

export function GuideBlock({ question, audience }: { question: Question; audience: "agency" | "client" }) {
  const g = useGuide(question).data;
  if (!g) return null;
  return <section className="guide" aria-label="Step-by-step guide">
    <div className="section-label"><span>STEP BY STEP</span><span>{progressLine(g.progress)}</span></div>
    {g.objective && <p className="guide-objective">What it is for: {g.objective}</p>}
    {audience === "agency" && g.source === "PACK" && <small className="guide-source">The agency's standard guide for this work.</small>}
    <ol className="guide-steps">{g.steps.map((s) => <GuideStepItem key={s.id} step={s} question={question} canLog={g.can_log} audience={audience} />)}</ol>
    {g.unknowns.length > 0 && <div className="guide-unknowns"><b>Not settled yet</b><ul>{g.unknowns.map((u) => <li key={u}>{u}</li>)}</ul></div>}
  </section>;
}

function GuideStepItem({ step: s, question, canLog, audience }: { step: GuideStep; question: Question; canLog: boolean; audience: "agency" | "client" }) {
  const ds = useDataSource();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<GuideStepState | null>(null);
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const tag = s.logged?.state ?? "TODO";

  const send = async () => {
    if (!state) return;
    setBusy(true); setMsg(null);
    let assetId: string | undefined;
    if (state === "DONE" && s.proof === "FILE") {
      if (!file) { setBusy(false); setMsg("Add the file that shows it."); return; }
      const up = await ds.assets.upload({
        organizationId: question.organization_id, scope: "PROJECT", projectId: question.project_id, kind: "IMAGE", name: file.name,
        rights: "OWNED_BY_CLIENT", provenance: audience === "agency" ? "CEO_PROVIDED" : "CLIENT_PROVIDED", file,
      });
      if (up.error || !up.data) { setBusy(false); setMsg(up.error?.message ?? "The file could not be added."); return; }
      assetId = up.data.id;
    }
    const r = await ds.questions.logStep(question.id, s.id, {
      state, ...(note.trim() ? { note: note.trim() } : {}), ...(link.trim() ? { link: link.trim() } : {}), ...(assetId ? { assetId } : {}),
    });
    setBusy(false);
    if (r.error) { setMsg(r.error.message); return; }
    setState(null); setNote(""); setLink(""); setFile(null);
    qc.setQueryData(["guide", question.id], r.data);
  };

  return <li className={`guide-step ${tag.toLowerCase()}`} aria-label={s.title}>
    <div className="guide-step-head">
      <Button variant="ghost" className="guide-step-title" aria-expanded={open} onClick={() => setOpen(!open)}>{s.title}</Button>
      <span className={`pill ${tag === "DONE" ? "green" : tag === "STUCK" ? "red" : tag === "SKIPPED" ? "slate" : "amber"}`}>{STATE_TAG[tag]}</span>
    </div>
    {s.logged && <small className="guide-logged">{[s.logged.note, s.logged.link].filter(Boolean).join(" · ") || (s.logged.asset_id ? "A file shows it." : "")}</small>}
    {open && <div className="guide-step-body">
      <ul className="guide-how">{s.how.map((h) => <li key={h}>{h}</li>)}</ul>
      <p className="guide-done-when"><b>Done when</b> {s.done_when}</p>
      {s.watch_out.length > 0 && <ul className="guide-watch" aria-label="Watch out">{s.watch_out.map((w) => <li key={w}>{w}</li>)}</ul>}
      {s.sources.length > 0 && <p className="guide-sources">Sources: {s.sources.map((x, n) => <span key={x.url}>{n ? ", " : ""}<a href={x.url} target="_blank" rel="noreferrer noopener">{x.title}</a></span>)}</p>}
      {PROOF_ASK[s.proof] && <small className="guide-proof">Needs: {PROOF_ASK[s.proof]!.toLowerCase()}.</small>}
      {canLog && <div className="guide-log" role="group" aria-label={`Log ${s.title}`}>
        {(["DONE", "STUCK", ...(s.proof === "NONE" ? ["SKIPPED" as const] : [])] as GuideStepState[]).map((o) =>
          <Button key={o} variant="ghost" className={state === o ? "chosen" : ""} aria-pressed={state === o} onClick={() => { setState(state === o ? null : o); setMsg(null); }}>
            {o === "DONE" ? "Done" : o === "STUCK" ? "I'm stuck" : "Skip it"}</Button>)}
        {state && <div className="plan-confirm">
          {state === "DONE" && s.proof === "LINK" && <label>Link that shows it<input inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} /></label>}
          {state === "DONE" && s.proof === "FILE" && <label>File that shows it<input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>}
          <label>{state === "STUCK" ? "What is in the way?" : state === "SKIPPED" ? "Why skip it?" : s.proof === "NOTE" ? "What was done?" : "Add a note (optional)"}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <Button className="approve-btn" disabled={busy} onClick={send}>Log it</Button>
        </div>}
      </div>}
      {msg && <p className="mmsg" role="status">{msg}</p>}
    </div>}
  </li>;
}
