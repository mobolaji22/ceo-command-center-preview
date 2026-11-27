"use client";

import { ArrowUp, ListChecks, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { COPY, say } from "@/copy";
import { useDataSource } from "@/lib/data";
import { useRooms } from "@/lib/domains";
import { label } from "@/lib/format";
import type { StudioAskAnswer } from "@/lib/studio/v4";

/**
 * The studio head's composer, docked at the foot of the studio (v4 ADR-0099 Decision 9). v4 reads the words and says where they go,
 * with no model call: a place to open, a status answer from its records, or a request. A request goes to the studio unchanged through
 * the same path as any other (`intents.submit`), and the reply says where it now stands.
 */
type Shown = { kind: "ANSWER"; answer: Extract<StudioAskAnswer, { kind: "ANSWER" }> } | { kind: "TAKEN"; status: string } | { kind: "ERROR"; message: string };

export function Composer({ onGo, onBrief, onRequests }: {
  onGo: (to: { place: "ROOM"; room: string } | { place: "FLOOR" }) => void;
  onBrief: () => void;
  onRequests: () => void;
}) {
  const c = COPY.studio.composer;
  const ds = useDataSource();
  const { roomName } = useRooms();
  const id = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const words = text.trim();
    if (!words || busy) return;
    setBusy(true);
    try {
      const r = await ds.commands.ask(words);
      if (r.error || !r.data) { setShown({ kind: "ERROR", message: r.error?.message ?? "" }); return; }
      const a = r.data;
      if (a.kind === "GO") {
        setText(""); setShown(null);
        if (a.place === "FLOOR") onGo({ place: "FLOOR" });
        else if (a.room) onGo({ place: "ROOM", room: a.room });
        return;
      }
      if (a.kind === "ANSWER") { setShown({ kind: "ANSWER", answer: a }); return; }
      const sent = await ds.intents.submit({ organizationId: null, text: words, attachments: [] });
      if (sent.error || !sent.data) { setShown({ kind: "ERROR", message: sent.error?.message ?? "" }); return; }
      setText("");
      setShown({ kind: "TAKEN", status: sent.data.status });
    } finally { setBusy(false); }
  };

  return (
    <div className="composer-dock">
      {shown && <div className="composer-reply" role="status" aria-live="polite">
        <button type="button" className="composer-dismiss" aria-label={c.dismiss} onClick={() => setShown(null)}><X size={14} aria-hidden="true" /></button>
        {shown.kind === "ERROR" && <p>{shown.message}</p>}
        {shown.kind === "TAKEN" && <p>{c.taken} <span className="composer-status">{label(shown.status)}</span> <button type="button" className="composer-link" onClick={onRequests}>{c.requests}</button></p>}
        {shown.kind === "ANSWER" && <Answer a={shown.answer} roomName={roomName} onBrief={onBrief} />}
      </div>}
      <form className="composer" onSubmit={send} aria-label={c.label}>
        <input id={`${id}-input`} aria-label={c.label} className="composer-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={c.placeholder} autoComplete="off" maxLength={2000} />
        <button type="submit" className="composer-send" disabled={busy || !text.trim()} aria-label={busy ? c.sending : c.send}><ArrowUp size={16} aria-hidden="true" /></button>
        <button type="button" className="composer-requests" onClick={onRequests}><ListChecks size={15} aria-hidden="true" /><span>{c.requests}</span></button>
      </form>
    </div>
  );
}

function Answer({ a, roomName, onBrief }: { a: Extract<StudioAskAnswer, { kind: "ANSWER" }>; roomName: (code: string) => string; onBrief: () => void }) {
  const c = COPY.studio.composer;
  const kinds = COPY.studio.decide.kinds;
  const head = <h3 className="composer-answer-head">{c.answers[a.topic]}{a.room && <span className="composer-answer-room"> · {say(c.inRoom, { room: roomName(a.room) })}</span>}</h3>;
  if (a.topic === "NEW") return <>{head}<p>{a.know.count ? say(c.newCount, { count: a.know.count }) : c.empty.NEW} {a.know.count > 0 && <button type="button" className="composer-link" onClick={onBrief}>{c.openBrief}</button>}</p></>;
  const rows = a.topic === "NEEDS_YOU"
    ? a.decide.map((d) => ({ key: `${d.kind}:${d.id}`, title: d.title, note: kinds[d.kind] }))
    : a.held.map((h) => ({ key: h.taskId, title: h.title, note: `${roomName(h.room)} · ${h.reason ? label(h.reason) : c.noReason}` }));
  return <>{head}{rows.length === 0 ? <p>{c.empty[a.topic]}</p> : <ul className="composer-answer">{rows.map((r) => <li key={r.key}><span>{r.title}</span><span className="composer-answer-note">{r.note}</span></li>)}</ul>}</>;
}
