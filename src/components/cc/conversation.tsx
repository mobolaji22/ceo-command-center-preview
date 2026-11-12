"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import type { ConversationMessage, ConversationView, FindingClass } from "@/lib/model";
import { fmtAgo } from "@/lib/format";

/** How a finding is held, in words, as in the understanding (v4 ADR-0076). */
const FOUND: Record<FindingClass, string> = { VERIFIED: "We found", HYPOTHESIS: "We read this, but could not check the quote" };

/** How a question the person's words settled is said back to them. */
function settled(a: ConversationMessage["answered"][number]): string {
  if (a.kind === "LATER") return `${a.question} Left for later, as you asked.`;
  if (a.kind === "DEFAULT") return `${a.question} You left it to us: ${a.chosen ?? "our recommendation"}.`;
  return `${a.question} ${a.chosen ?? ""}`.trim();
}

/** While a message waits for the agency's reply, the conversation is read again now and then: the reply is written in v4's worker. */
const WAIT_POLL_MS = 8000;

/**
 * The conversation on one request (v4 ADR-0077): the person writes as they would to a colleague, and the agency replies. The
 * question cards stay below as one-tap shortcuts. A reply says what the person's words settled and any separate ask it kept apart,
 * each of which can be started as its own request. Everything shown is v4's (INV-27): who said what, what was applied, what is
 * the agency's to see. Writing here settles nothing by itself; v4 reads it and replies.
 */
export function ConversationPanel({ intentId, organizationId, stamp, canWrite, questionsBelow, onChanged }: { intentId: string; organizationId: string; stamp: string; canWrite: boolean; questionsBelow: boolean; onChanged: () => void }) {
  const ds = useDataSource();
  const [view, setView] = useState<ConversationView | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void ds.intents.conversation(intentId).then((r) => { if (live) setView(r.data); });
    return () => { live = false; };
  }, [ds, intentId, stamp, tick]);
  const waiting = view?.waiting_for_reply ?? false;
  useEffect(() => {
    if (!waiting) return;
    const t = window.setInterval(() => setTick((n) => n + 1), WAIT_POLL_MS);
    return () => window.clearInterval(t);
  }, [waiting]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true); setNote(null);
    const r = await ds.intents.say(intentId, text);
    setBusy(false);
    if (r.error) { setNote(r.error.message); return; }
    setDraft("");
    if (r.data?.change_intent_id) setNote("This request is already understood, so we've taken your message as a change to its plan.");
    setTick((n) => n + 1); onChanged();
  };
  const startSeparately = async (words: string) => {
    setNote(null);
    const r = await ds.intents.submit({ organizationId, text: words, attachments: [] });
    setNote(r.error ? r.error.message : "Started as its own request.");
    if (!r.error) onChanged();
  };

  if (!view) return null;
  if (view.messages.length === 0 && !canWrite) return null;
  return <section className="convo" aria-label="Conversation about this request">
    <h4>Talk to us about this request</h4>
    {view.messages.length > 0 && <ol className="convo-thread">
      {view.messages.map((m) => <li key={m.id} data-from={m.from}>
        <span className="convo-who">{m.from === "AGENCY" ? "The agency" : m.from === "PLATFORM" ? "Note" : m.mine ? "You" : "The client"}<small>{fmtAgo(m.at)}</small></span>
        <p>{m.text}</p>
        {m.answered.length > 0 && <div className="convo-took"><small>From your message we took:</small>
          <ul>{m.answered.map((a) => <li key={a.question_id}><small>{settled(a)} <q>{a.your_words}</q></small></li>)}</ul></div>}
        {m.no_longer_asked.length > 0 && <small className="convo-sub">No longer asked: {m.no_longer_asked.map((q) => q.question).join("; ")}</small>}
        {m.findings.length > 0 && <ul className="und-findings">{m.findings.map((f, n) => <li key={n} data-class={f.class}><small><strong>{FOUND[f.class]}:</strong> {f.says} · <a href={f.source.url} target="_blank" rel="noopener noreferrer">{f.source.title || f.source.url}</a></small></li>)}</ul>}
        {m.separate_asks.length > 0 && <div className="convo-apart"><small>Kept apart, as its own piece of work:</small>
          {m.separate_asks.map((s) => <div key={s.your_words} className="convo-apart-row"><small>{s.ask}</small>
            {canWrite && <Button variant="outline" size="sm" onClick={() => void startSeparately(s.your_words)}>Start it as its own request</Button>}</div>)}</div>}
        {m.refused && m.refused.length > 0 && <small className="convo-sub">For the agency, not applied: {m.refused.map((r) => `${r.question_id} (${r.why})`).join("; ")}</small>}
      </li>)}
    </ol>}
    {waiting && <p className="convo-sub" role="status">The agency will reply here.</p>}
    {note && <p className="mmsg" role="status">{note}</p>}
    {canWrite && <div className="convo-write">
      <textarea aria-label="Your message" rows={2} placeholder="Ask why, correct us, or answer in your own words…" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <Button disabled={busy || !draft.trim()} onClick={() => void send()}>Send</Button>
    </div>}
    {canWrite && questionsBelow && <small className="convo-sub">Or tap an answer on a question below.</small>}
  </section>;
}
