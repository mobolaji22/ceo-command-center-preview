"use client";

import { useEffect, useState } from "react";
import { useDataSource } from "@/lib/data";
import type { FindingClass, UnderstandingVersion, UnderstandingView } from "@/lib/model";
import { fmtAgo } from "@/lib/format";
import { BASIS } from "./open-decisions";

/** How a finding is held, in words (v4 ADR-0076): only a quote that was in what we read counts as found. */
const FOUND: Record<FindingClass, string> = { VERIFIED: "We found", HYPOTHESIS: "We read this, but could not check the quote" };

const STANDING: Record<UnderstandingVersion["recommend"][number]["standing"], string> = {
  OPEN: "Waiting for your answer", ANSWERED: "You chose", ASSUMED: "We are going with", LEFT_TO_DECIDE: "Left for you to decide", WITHDRAWN: "No longer asked",
};

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

/**
 * One understanding of a request (v4 ADR-0076 Decision 5), in four parts: what we understood, what we found, what we recommend,
 * and what still needs you. Each reading round is a version; the latest is shown, and earlier ones can be opened. It renders v4's
 * view as it is (INV-27): what is shown to whom is decided there. `questionsBelow` says the card already lists the open questions.
 */
export function UnderstandingPanel({ intentId, stamp, questionsBelow }: { intentId: string; stamp: string; questionsBelow: boolean }) {
  const ds = useDataSource();
  const [view, setView] = useState<UnderstandingView | null>(null);
  const [round, setRound] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void ds.intents.understanding(intentId).then((r) => { if (live) { setView(r.data); setRound(null); } });
    return () => { live = false; };
  }, [ds, intentId, stamp]);
  if (!view || view.versions.length === 0) return null;
  const v = view.versions.find((x) => x.round === round) ?? view.versions[view.versions.length - 1]!;
  const needs = view.still_needs_you;

  return <details className="cv-more understanding" open aria-label="How we understand this request">
    <summary>How we understand this{view.versions.length > 1 ? ` · version ${v.round} of ${view.versions.length}` : ""}</summary>
    {view.versions.length > 1 && <div className="und-versions" role="group" aria-label="Versions">
      {view.versions.map((x) => <button key={x.round} type="button" aria-pressed={x.round === v.round} onClick={() => setRound(x.round)}>{x.current ? "Now" : `Version ${x.round}`}<small>{fmtAgo(x.at)}</small></button>)}
    </div>}
    {!v.current && <p className="cv-sub">An earlier version, kept as it was read then.</p>}

    <div className="cv-block"><h4>What we understood</h4>
      {v.understood ? <>
        <p>{v.understood.goal}</p>
        {v.understood.desired_outcome && <p className="cv-sub">The result you want: {v.understood.desired_outcome}</p>}
        {v.understood.objectives.length > 0 && <ul>{v.understood.objectives.map((o) => <li key={o}>{o}</li>)}</ul>}
        {v.understood.constraints.length > 0 && <p className="cv-sub">Within: {v.understood.constraints.join("; ")}</p>}
      </> : <p className="cv-sub">This version was read before we kept each one; the latest holds the whole reading.</p>}
    </div>

    <div className="cv-block"><h4>What we found</h4>
      {v.found.findings.length === 0 && v.found.finding_out.length === 0 && <p className="cv-sub">Nothing we looked up changes what we ask.</p>}
      {v.found.findings.length > 0 && <ul className="und-findings">{v.found.findings.map((f, n) => <li key={n} data-class={f.class}>
        <strong>{FOUND[f.class]}:</strong> {f.says}
        <small>“{f.source.quote}” · <a href={f.source.url} target="_blank" rel="noopener noreferrer">{f.source.title || hostOf(f.source.url)}</a></small>
      </li>)}</ul>}
      {v.found.finding_out.length > 0 && <><p className="cv-sub">We will find these out ourselves, so you are not asked:</p>
        <ul>{v.found.finding_out.map((x) => <li key={x.id}>{x.question}</li>)}</ul></>}
      {v.looked_up && <p className="cv-sub">For the agency: {v.looked_up.searches} {v.looked_up.searches === 1 ? "search" : "searches"}, {v.looked_up.pages} {v.looked_up.pages === 1 ? "page" : "pages"} opened{v.looked_up.flagged > 0 ? `. ${v.looked_up.flagged} ${v.looked_up.flagged === 1 ? "search held" : "searches held"} an email address or phone number, which our guidance forbids; it was masked in the record` : ""}.</p>}
    </div>

    <div className="cv-block"><h4>What we recommend</h4>
      {v.recommend.length === 0 ? <p className="cv-sub">Nothing to recommend yet.</p>
        : <ul className="und-recommend">{v.recommend.map((r) => <li key={r.id}>
          <b>{r.question}</b>
          {(() => {
            const settled = (r.standing === "ANSWERED" || r.standing === "ASSUMED") && r.chosen;
            // When what was chosen is what we recommended, one line says both.
            if (settled && r.chosen === r.recommended) return <small>{STANDING[r.standing]}: {r.chosen}, as we recommended.{r.why ? ` ${r.why}` : ""}</small>;
            return <>
              {r.recommended && <small>We recommend: {r.recommended}.{r.why ? ` ${r.why}` : ""}</small>}
              <small>{STANDING[r.standing]}{settled ? `: ${r.chosen}` : ""}.</small>
            </>;
          })()}
          {r.counsel && <div className="counsel"><small>You asked for {r.counsel.asked}. {r.counsel.concern}</small>
            <ul>{r.counsel.evidence.map((e, i) => <li key={i}><small><strong>{BASIS[e.class]}:</strong> {e.says}</small></li>)}</ul></div>}
        </li>)}</ul>}
    </div>

    {v.current && <div className="cv-block"><h4>What still needs you</h4>
      {needs.questions.length === 0 && needs.decisions.length === 0 ? <p className="cv-sub">Nothing right now.</p> : <>
        {needs.questions.length > 0 && (questionsBelow
          ? <p className="cv-sub">{needs.questions.length === 1 ? "One question, below." : `${needs.questions.length} questions, below.`}</p>
          : <ul>{needs.questions.map((q) => <li key={q.id}>{q.question}<small> · {q.why}</small></li>)}</ul>)}
        {needs.decisions.length > 0 && <><p className="cv-sub">Decisions the plan carries until you settle them:</p>
          <ul>{needs.decisions.map((d) => <li key={d.id}>{d.question}{d.recommended && <small> · We recommend: {d.recommended}</small>}</li>)}</ul></>}
      </>}
    </div>}
  </details>;
}
