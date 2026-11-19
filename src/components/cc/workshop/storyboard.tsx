"use client";

import { Check, Clapperboard, Film, MessageSquare, Plus, Send } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import type { Result } from "@/lib/data/types";
import { applyOp, type Op } from "@/lib/design/edit";
import type { SddDocument } from "@/lib/design/v4";
import { sceneDocument, storyboardFrom, type MediaStudioPiece, type MediaStudioStoryboard, type MediaStudioView } from "@/lib/media/v4";
import { Artboard } from "./canvas";
import { Field, Section } from "./fields";

/**
 * The storyboard desk (v4 ADR-0085 Decision 3, Order step 3): Media's own scenes, in order, edited on the Workshop's own canvas, and
 * Design's decision on them. The canvas edits the document v4 composed (the approved design with the scenes beside its frames), so
 * a scene draws here as it renders; only the scenes' own nodes go back to v4. v4 decides everything: a changed scene sends the
 * storyboard back to a draft, Design approves a storyboard in review, and a piece renders only from what Design approved.
 */

type SaveState = "saved" | "saving" | "failed" | "conflict";
const SAVE_WORDS: Record<SaveState, string> = { saved: "Saved", saving: "Saving…", failed: "Could not save", conflict: "Out of date" };
const STATUS_WORDS: Record<MediaStudioStoryboard["storyboard"]["status"], string> = { DRAFT: "Draft", IN_REVIEW: "With Design", APPROVED: "Approved" };

export function Storyboards({ projectId, view, header, openPiece, refresh }: { projectId: string; view: MediaStudioView; header: React.ReactNode; openPiece: (p?: MediaStudioPiece) => void; refresh: () => void }) {
  const ds = useDataSource();
  const [boardId, setBoardId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const board = view.storyboards.find((b) => b.id === boardId) ?? view.storyboards[0] ?? null;
  const start = async () => {
    setMsg(null);
    const r = await ds.media.startStoryboard(projectId);
    if (r.error || !r.data) { setMsg(r.error?.message ?? "Could not open a storyboard."); return; }
    setBoardId(r.data.id);
    refresh();
  };
  if (!board) {
    return (
      <div className="workshop studio" data-desk="storyboard">
        <div className="ws-toolbar">{header}</div>
        <div className="workshop-empty"><div>
          <h3>No storyboard yet.</h3>
          <p className="ws-note">A storyboard is Media&apos;s own scenes for an explainer, a reel or a carousel, drawn in the approved design&apos;s colours and type with the copy deck&apos;s words. Design approves it before a piece renders from it.</p>
          <div className="ws-actions"><Button variant="ghost" className="ws-btn" onClick={() => openPiece()}>Back to pieces</Button><Button className="ws-btn primary" onClick={() => void start()}><Plus size={14} /> Open a storyboard</Button></div>
          {msg && <p className="mmsg" role="status">{msg}</p>}
        </div></div>
      </div>
    );
  }
  return <Board key={board.id} projectId={projectId} view={view} board={board} header={header} choose={setBoardId} start={() => void start()} openPiece={openPiece} refresh={refresh} />;
}

function Board({ projectId, view, board: given, header, choose, start, openPiece, refresh }: {
  projectId: string; view: MediaStudioView; board: MediaStudioStoryboard; header: React.ReactNode; choose: (id: string) => void; start: () => void; openPiece: (p?: MediaStudioPiece) => void; refresh: () => void;
}) {
  const ds = useDataSource();
  // The storyboard as v4 last answered; the canvas's document as the person has it now.
  const [board, setBoard] = useState(given);
  const [doc, setDoc] = useState<SddDocument | null>(sceneDocument(given));
  const [sceneId, setSceneId] = useState(given.scenes[0]?.id ?? "");
  const [selection, setSelection] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [asking, setAsking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const hash = useRef(given.documentHash);
  const pending = useRef(0);
  const inflight = useRef<Promise<void>>(Promise.resolve());
  const toastTimer = useRef(0);
  const say = (m: string) => { setToast(m); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(null), 4200); };
  useEffect(() => () => { window.clearTimeout(toastTimer.current); window.clearTimeout(pending.current); }, []);

  const took = useCallback((b: MediaStudioStoryboard) => { hash.current = b.documentHash; setBoard(b); }, []);
  const sb = board.storyboard;
  const scene = board.scenes.find((s) => s.id === sceneId) ?? board.scenes[0];

  /** A canvas change, applied as the Workshop applies it, then saved to v4 straight after; v4's answer is what the desk shows. */
  const onOp = (op: Op): string | null => {
    if (!doc) return null;
    const applied = applyOp(doc, op);
    if (applied.error) { say(applied.error); return applied.error; }
    if (applied.doc === doc) return null;
    setDoc(applied.doc);
    setSaveState("saving");
    window.clearTimeout(pending.current);
    const next = storyboardFrom(board, applied.doc);
    pending.current = window.setTimeout(() => { inflight.current = inflight.current.then(async () => {
      const r = await ds.media.saveStoryboard(projectId, board.id, next, hash.current);
      if (r.error || !r.data) {
        if (r.error?.code === "STALE_STORYBOARD") { setSaveState("conflict"); return; }
        setSaveState("failed"); say(r.error?.message ?? "Could not save.");
        return;
      }
      took(r.data);
      setSaveState("saved");
      refresh();
    }); }, 450);
    return null;
  };

  const act = async (run: () => Promise<Result<MediaStudioStoryboard>>, done: string) => {
    await inflight.current;
    const r = await run();
    if (r.error || !r.data) { say(r.error?.problems?.length ? `${r.error.message} ${r.error.problems.join("; ")}` : r.error?.message ?? "v4 did not take that."); return; }
    took(r.data);
    setDoc(sceneDocument(r.data));
    say(done);
    refresh();
  };
  const send = () => act(() => ds.media.sendStoryboard(projectId, board.id, hash.current), "Sent to Design.");
  const approve = () => act(() => ds.media.decideStoryboard(projectId, board.id, { decision: "APPROVE", changes: [], expectedHash: hash.current }), `Approved for Design. Pieces made from it render from this revision.`);
  const makePiece = async () => {
    const r = await ds.media.startPiece(projectId, { storyboardId: sb.storyboardId });
    if (r.error || !r.data) { say(r.error?.message ?? "Could not start the piece."); return; }
    refresh();
    openPiece(r.data);
  };

  const busy = saveState !== "saved";
  const changedAfter = board.approvedRevision !== null && sb.status !== "APPROVED" && board.changedScenes.length > 0;
  const plays = view.pieces.filter((p) => p.timeline.storyboard?.storyboardId === sb.storyboardId);

  return (
    <div className="workshop studio" data-desk="storyboard">
      <div className="ws-toolbar" role="toolbar" aria-label="Storyboard tools">
        <div className="ws-tb-top">{header}</div>
        <div className="ws-tb-tools">
          <div className="ws-group">
            {view.storyboards.length > 1
              ? <select className="ws-select" aria-label="Storyboard" value={board.id} onChange={(e) => choose(e.target.value)}>{view.storyboards.map((b) => <option key={b.id} value={b.id}>{b.storyboard.storyboardId}</option>)}</select>
              : <b className="ws-project">{sb.storyboardId}</b>}
            <button type="button" className="ws-ibtn" aria-label="New storyboard" title="Open another storyboard" onClick={start}><Plus size={15} /></button>
          </div>
          <div className="ws-group">
            {sb.status === "DRAFT" && <Button className="ws-btn primary" disabled={busy || board.problems.length > 0} onClick={() => void send()}><Send size={14} /> Send to Design</Button>}
            {sb.status === "IN_REVIEW" && <>
              <Button variant="ghost" className="ws-btn" disabled={busy} aria-pressed={asking} onClick={() => setAsking((a) => !a)}><MessageSquare size={14} /> Ask for changes</Button>
              <Button className="ws-btn primary" disabled={busy || board.problems.length > 0} onClick={() => void approve()}><Check size={14} /> Approve for Design</Button>
            </>}
            <Button variant="ghost" className="ws-btn" disabled={busy} onClick={() => void makePiece()}><Film size={14} /> Make a piece</Button>
            <Button variant="ghost" className="ws-btn" onClick={() => openPiece(plays[0])}><Clapperboard size={14} /> Pieces</Button>
          </div>
          <span className="ws-status">
            <span className={`ws-chip${sb.status === "APPROVED" ? " good" : ""}`} data-status={sb.status}>{STATUS_WORDS[sb.status]}{board.approvedRevision !== null ? `, revision ${board.approvedRevision} approved` : ""}</span>
            <span className={`ws-save is-${saveState === "saving" ? "saving" : saveState}`} role="status">{SAVE_WORDS[saveState]}{saveState === "conflict" && <button type="button" onClick={() => refresh()}>Reload</button>}</span>
          </span>
        </div>
      </div>
      {changedAfter && <p className="ws-banner warn" role="status">Changed since Design approved revision {board.approvedRevision}: {board.changedScenes.map((id) => board.scenes.find((s) => s.id === id)?.label ?? id).join(", ")}. Pieces made from it render again once Design approves the change.</p>}
      {board.decision?.decision === "CHANGES" && sb.status === "DRAFT" && (
        <section className="ws-banner quiet" aria-label="Changes Design asked for">
          <p><b>Design asked for changes:</b></p>
          <ul className="st-list">{board.decision.changes.map((c, i) => <li key={i}><b>{board.scenes.find((s) => s.id === c.sceneId)?.label ?? c.sceneId}:</b> {c.note}</li>)}</ul>
        </section>
      )}
      {asking && <div className="ws-banner quiet"><AskChanges board={board} sceneId={scene?.id ?? ""} onCancel={() => setAsking(false)}
        onSend={(changes) => void act(() => ds.media.decideStoryboard(projectId, board.id, { decision: "CHANGES", changes, expectedHash: hash.current }), "Sent back to Media with the changes.").then(() => setAsking(false))} /></div>}

      <div className="ws-main st-main">
        <aside className="ws-left" aria-label="Scenes">
          <div className="ws-tabs"><button type="button" className="active">Scenes</button></div>
          <div className="ws-tabpanel">
            <ol className="sb-strip" aria-label="Storyboard strip">
              {board.scenes.map((s, i) => (
                <li key={s.id}>
                  <button type="button" className="sb-scene" aria-pressed={s.id === scene?.id} onClick={() => { setSceneId(s.id); setSelection([]); }}>
                    <span className="sb-thumb">{doc && <Thumb doc={doc} frameId={s.id} />}</span>
                    <span className="sb-label"><b>{i + 1}</b> {s.label}{board.changedScenes.includes(s.id) && board.approvedRevision !== null && <span className="ws-chip">changed</span>}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <section className="ws-center" aria-label="Scene canvas">
          <SceneCanvas doc={doc} sceneId={scene?.id ?? ""} selection={selection} setSelection={setSelection} onOp={onOp} say={say} />
          {sb.status !== "DRAFT" && <p className="st-caption">Changing a scene sends the storyboard back to a draft; Design approves it again before a piece renders from it.</p>}
        </section>

        <aside className="ws-inspector" aria-label="Inspector">
          <div className="ws-tabs"><button type="button" className="active">Storyboard</button></div>
          <div className="ws-tabpanel">
            <Section title="Before Design approves">
              {board.problems.length
                ? <><p className="ws-warn">v4 holds this back:</p><ul className="st-list">{board.problems.map((p) => <li key={p}>{p}</li>)}</ul></>
                : <p className="ws-note">Every scene uses the brand&apos;s colours and type, and shows the copy deck&apos;s words.</p>}
            </Section>
            {board.decision && <Section title="Design's last answer"><p className="ws-note">{board.decision.decision === "APPROVE" ? "Approved" : "Asked for changes"} on {new Date(board.decision.at).toLocaleString()}.</p></Section>}
            <Section title="Script">
              {view.script.length
                ? <ol className="st-list sb-script">{view.script.map((l) => <li key={l.key}>{l.text}</li>)}</ol>
                : <p className="ws-note">No script yet. Content writes it as copy-deck lines in the script group; Media times each line on a piece.</p>}
            </Section>
            {plays.length > 0 && <Section title="Pieces made from it"><ul className="st-outputs">{plays.map((p) => <li key={p.id}><button type="button" className="ws-layer" onClick={() => openPiece(p)}>{p.timeline.timelineId}<span className="ws-chip">revision {p.timeline.storyboard?.revision ?? 0}</span></button></li>)}</ul></Section>}
          </div>
        </aside>
      </div>
      {toast && <p className="ws-toast" role="status">{toast}</p>}
    </div>
  );
}

const Thumb = memo(function Thumb({ doc, frameId }: { doc: SddDocument; frameId: string }) {
  const frame = doc.frames.find((f) => f.id === frameId);
  return frame?.width ? <Artboard doc={doc} frameId={frameId} scale={200 / frame.width} readOnly /> : null;
}, (a, b) => a.frameId === b.frameId && a.doc === b.doc);

/** The selected scene on the Workshop's canvas, scaled to the room there is. */
function SceneCanvas({ doc, sceneId, selection, setSelection, onOp, say }: { doc: SddDocument | null; sceneId: string; selection: string[]; setSelection: (ids: string[]) => void; onOp: (op: Op) => string | null; say: (m: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ w: 640, h: 360 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRoom({ w: Math.max(160, el.clientWidth - 32), h: Math.max(120, el.clientHeight - 32) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const frame = doc?.frames.find((f) => f.id === sceneId);
  if (!doc || !frame?.width || !frame.height) return <div className="ws-stage" ref={ref}><p className="ws-note">The project has no approved design for the scenes to draw with.</p></div>;
  const scale = Math.min(room.w / frame.width, room.h / frame.height);
  return (
    <div className="ws-stage sb-stage" ref={ref}>
      <Artboard doc={doc} frameId={frame.id} scale={scale} selection={selection.filter((id) => frame.nodeIds.includes(id))} onSelect={setSelection} onOp={(op) => onOp(op)} snap grid={false} onRefuse={say} />
    </div>
  );
}

/** Design's request for changes: a scene and what to change on it, as many as needed. */
function AskChanges({ board, sceneId, onSend, onCancel }: { board: MediaStudioStoryboard; sceneId: string; onSend: (changes: Array<{ sceneId: string; note: string }>) => void; onCancel: () => void }) {
  const [scene, setScene] = useState(sceneId);
  const [note, setNote] = useState("");
  return (
    <div className="st-ask">
      <Field label="Scene"><select value={scene} onChange={(e) => setScene(e.target.value)}>{board.scenes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
      <Field label="What to change"><textarea rows={2} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} /></Field>
      <div className="ws-actions"><Button variant="ghost" className="ws-btn" onClick={onCancel}>Cancel</Button><Button className="ws-btn primary" disabled={!note.trim() || !scene} onClick={() => onSend([{ sceneId: scene, note: note.trim() }])}>Send the changes</Button></div>
    </div>
  );
}
