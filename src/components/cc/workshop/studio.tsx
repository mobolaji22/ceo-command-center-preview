"use client";

import { Clapperboard, Download, Film, Lock, Pause, Play, Plus, Type } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import {
  OUTPUT_SHAPES, isStill, lineAt, seconds, setBeatLength, setCaptions, setOutput, setTrack, setTransition,
  type MediaStudioCheck, type MediaStudioFrame, type MediaStudioPiece, type MediaStudioRender, type MediaStudioView, type MediaTimeline, type NodePreset, type TransitionPreset,
} from "@/lib/media/v4";
import { Empty } from "../views";
import { Field, Num, Section } from "./fields";
import { Storyboards } from "./storyboard";

/**
 * The Media studio (v4 ADR-0081 Decision 13): the Workshop's timeline panel over the project's approved design. The agency plays
 * v4's preview, scrubs it, edits the timeline's free values (a beat's length, a hand-over, how an element moves, the outputs) and asks
 * for a render; v4's worker makes the file and Design's check reads it, and the check rail shows each verdict as v4 recorded it. The
 * studio decides nothing: an element Design locked is refused by v4, and the change goes to Design as a change request on it.
 */

type Selection = { kind: "beat"; id: string } | { kind: "node"; id: string } | { kind: "output"; id: string } | null;
type SaveState = "saved" | "saving" | "failed" | "conflict";
type Refused = { nodeId: string; message: string; asked: boolean };

/** The checks by what a person reads them as; the ids are v4's. */
const CHECK_WORDS: Record<MediaStudioCheck["id"], string> = {
  "media-validate": "Words and slots",
  "media-technical-report": "The file",
  "media-self-check": "Media's own read",
  "design-fidelity": "Design's check",
};
const GATE_WORDS: Record<MediaStudioCheck["gate"], string> = { PASSED: "Passed", FAILED: "Failed", NOT_MEASURED: "Not measured", OPEN_PENDING_INDEPENDENCE: "Waiting for Design" };
const STATUS_WORDS: Record<MediaStudioRender["status"], string> = { QUEUED: "Waiting for the worker", RENDERING: "Rendering", RENDERED: "Rendered", REFUSED: "Not rendered", FAILED: "Failed" };
const SAVE_WORDS: Record<SaveState, string> = { saved: "Saved", saving: "Saving…", failed: "Could not save", conflict: "Out of date" };
const words = (name: string) => name.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
const roleWords = (role: string) => words(role.replace(/[_.]+/g, " "));

export function MediaStudio({ projectId, header }: { projectId: string; header: React.ReactNode }) {
  const ds = useDataSource();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["media-studio", projectId],
    queryFn: async () => { const r = await ds.media.read(projectId); if (r.error) throw new Error(r.error.message); return r.data!; },
    // While the worker has a render, look again every two seconds; otherwise only when asked.
    refetchInterval: (query) => (query.state.data?.pieces.some((p) => p.renders.some((r) => r.status === "QUEUED" || r.status === "RENDERING")) ? 2000 : false),
  });
  const [pieceId, setPieceId] = useState<string | null>(null);
  // Two desks: the pieces, and the storyboards of Media's own scenes that Design approves (v4 ADR-0085).
  const [desk, setDesk] = useState<"pieces" | "storyboards">("pieces");
  const view = q.data;
  const piece = view?.pieces.find((p) => p.id === pieceId) ?? view?.pieces[0] ?? null;
  const refresh = useCallback(() => { void qc.invalidateQueries({ queryKey: ["media-studio", projectId] }); }, [qc, projectId]);

  const shell = (body: React.ReactNode) => <div className="workshop studio" data-desk="studio"><div className="ws-toolbar">{header}</div>{body}</div>;
  if (q.isError) return shell(<div className="workshop-empty"><Empty title="The studio could not be opened."><p>{(q.error as Error).message}</p><Button variant="ghost" className="ws-btn" onClick={() => void q.refetch()}>Try again</Button></Empty></div>);
  if (!view) return shell(<div className="workshop-empty"><span className="pulse-dot" /> Opening the studio…</div>);
  if (!view.design) return shell(<div className="workshop-empty"><Empty title="No approved design to play yet.">Media plays only a design the client approved. Once a revision is approved in the Workshop, its frames open here.</Empty></div>);
  if (desk === "storyboards") return <Storyboards projectId={projectId} view={view} header={header} refresh={refresh} openPiece={(p) => { if (p) setPieceId(p.id); setDesk("pieces"); }} />;
  if (!piece) return shell(<NewPiece projectId={projectId} view={view} onStarted={(p) => { setPieceId(p.id); void refresh(); }} openStoryboards={() => setDesk("storyboards")} />);
  return <Piece key={piece.id} projectId={projectId} view={view} piece={piece} header={header} choosePiece={setPieceId} refresh={refresh} openStoryboards={() => setDesk("storyboards")} />;
}

/** Where a new piece plays from: a frame of the approved design, or a storyboard of Media's own scenes. */
function NewPiece({ projectId, view, onStarted, openStoryboards, inline }: { projectId: string; view: MediaStudioView; onStarted: (p: MediaStudioPiece) => void; openStoryboards: () => void; inline?: boolean }) {
  const ds = useDataSource();
  const frames = view.design?.frames ?? [];
  const [from, setFrom] = useState(view.storyboards[0] ? `board:${view.storyboards[0].storyboard.storyboardId}` : frames[0] ? `frame:${frames[0].id}` : "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true); setMsg(null);
    const [kind, ...rest] = from.split(":");
    const ref = rest.join(":");
    const r = await ds.media.startPiece(projectId, kind === "board" ? { storyboardId: ref } : { frameId: ref });
    setBusy(false);
    if (r.error || !r.data) { setMsg(r.error?.message ?? "Could not start the piece."); return; }
    onStarted(r.data);
  };
  const form = (
    <div className="st-new">
      <Field label="Play from">
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          {view.storyboards.length > 0 && <optgroup label="Storyboards (Media's own scenes)">{view.storyboards.map((b) => <option key={b.id} value={`board:${b.storyboard.storyboardId}`}>{b.storyboard.storyboardId}, {b.scenes.length} scene{b.scenes.length === 1 ? "" : "s"}</option>)}</optgroup>}
          <optgroup label="Frames of the approved design">{frames.map((f) => <option key={f.id} value={`frame:${f.id}`}>{f.label}</option>)}</optgroup>
        </select>
      </Field>
      <div className="ws-actions">
        <Button variant="ghost" className="ws-btn" onClick={openStoryboards}><Clapperboard size={14} /> Storyboards</Button>
        <Button className="ws-btn primary" disabled={busy || !from} onClick={() => void start()}><Plus size={14} /> Start a piece</Button>
      </div>
      {msg && <p className="mmsg" role="status">{msg}</p>}
    </div>
  );
  if (inline) return form;
  return <div className="workshop-empty"><div><Empty title="No piece yet.">A piece is a short video or a still: over a frame of the approved design, or over a storyboard of Media&apos;s own scenes that Design approves. It starts from a first cut you can change.</Empty>{form}</div></div>;
}

function Piece({ projectId, view, piece, header, choosePiece, refresh, openStoryboards }: { projectId: string; view: MediaStudioView; piece: MediaStudioPiece; header: React.ReactNode; choosePiece: (id: string) => void; refresh: () => void; openStoryboards: () => void }) {
  const ds = useDataSource();
  const design = view.design!;
  const [timeline, setTimeline] = useState<MediaTimeline>(piece.timeline);
  const [hash, setHash] = useState(piece.timelineHash);
  const [problems, setProblems] = useState<string[]>(piece.problems);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [refused, setRefused] = useState<Refused | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<"edit" | "checks">("edit");
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [outputId, setOutputId] = useState(piece.timeline.outputs.find((o) => !isStill(o))?.id ?? piece.timeline.outputs[0].id);
  const [toast, setToast] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const saved = useRef({ timeline: piece.timeline, hash: piece.timelineHash });
  const pending = useRef<number>(0);
  // Saves go one after another, each on the hash the one before it returned, so two quick edits never race each other.
  const inflight = useRef<Promise<void>>(Promise.resolve());
  const toastTimer = useRef(0);
  const say = (m: string) => { setToast(m); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(null), 4200); };
  useEffect(() => () => { window.clearTimeout(toastTimer.current); window.clearTimeout(pending.current); }, []);

  // Each beat plays one scene: a frame of the design or a scene of the storyboard (v4 ADR-0085). The elements are the playing one's.
  const board = timeline.storyboard ? view.storyboards.find((b) => b.storyboard.storyboardId === timeline.storyboard!.storyboardId) : undefined;
  const scenes: MediaStudioFrame[] = [...design.frames, ...(board?.scenes ?? [])];
  const beatNow = timeline.beats.find((b) => at >= b.startMs && at < b.endMs) ?? timeline.beats[timeline.beats.length - 1]!;
  const sceneId = beatNow.sceneId;
  const frame = scenes.find((f) => f.id === sceneId);
  const output = timeline.outputs.find((o) => o.id === outputId) ?? timeline.outputs[0];

  /** Every change is saved to v4 straight after; a refusal puts the piece back as v4 holds it. */
  const write = useCallback((next: MediaTimeline, touched?: string) => {
    setTimeline(next);
    setSaveState("saving");
    window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => { inflight.current = inflight.current.then(async () => {
      const r = await ds.media.save(projectId, piece.id, next, saved.current.hash);
      if (r.error || !r.data) {
        if (r.error?.code === "LOCKED_NODE") {
          setTimeline(saved.current.timeline);
          setSaveState("saved");
          setRefused({ nodeId: touched ?? "", message: r.error.message, asked: false });
          return;
        }
        if (r.error?.code === "STALE_PIECE") { setSaveState("conflict"); return; }
        setSaveState("failed");
        say(r.error?.message ?? "Could not save.");
        return;
      }
      saved.current = { timeline: next, hash: r.data.timelineHash };
      setHash(r.data.timelineHash);
      setProblems(r.data.problems);
      setSaveState("saved");
    }); }, 450);
  }, [ds, projectId, piece.id]);

  const render = async () => {
    const r = await ds.media.render(projectId, piece.id, output.id, hash);
    if (r.error) { say(r.error.message); if (r.error.problems?.length) setProblems(r.error.problems); return; }
    say("Asked for. The worker renders it, then Design checks the file.");
    setTab("checks");
    refresh();
  };

  const node = selection?.kind === "node" ? scenes.flatMap((f) => f.nodes).find((n) => n.id === selection.id) : undefined;
  const busy = saveState !== "saved";
  const renders = piece.renders;

  return (
    <div className="workshop studio" data-desk="studio">
      <div className="ws-toolbar" role="toolbar" aria-label="Studio tools">
        <div className="ws-tb-top">{header}</div>
        <div className="ws-tb-tools">
          <div className="ws-group">
            {view.pieces.length > 1
              ? <select className="ws-select" aria-label="Piece" value={piece.id} onChange={(e) => choosePiece(e.target.value)}>{view.pieces.map((p) => <option key={p.id} value={p.id}>{p.timeline.timelineId}</option>)}</select>
              : <b className="ws-project">{piece.timeline.timelineId}</b>}
            <button type="button" className="ws-ibtn" aria-label="New piece" title="Start another piece" aria-pressed={adding} onClick={() => setAdding((a) => !a)}><Plus size={15} /></button>
            <Button variant="ghost" className="ws-btn" onClick={openStoryboards}><Clapperboard size={14} /> Storyboards</Button>
          </div>
          <div className="ws-group">
            <select className="ws-select" aria-label="Output" value={output.id} onChange={(e) => setOutputId(e.target.value)}>{timeline.outputs.map((o) => <option key={o.id} value={o.id}>{o.destination} ({o.width}x{o.height} {o.format})</option>)}</select>
            <Button className="ws-btn primary" disabled={busy || problems.length > 0} onClick={() => void render()}><Film size={14} /> Render</Button>
          </div>
          <span className="ws-status">
            <span className="ws-chip">Design version {design.revision}</span>
            {timeline.storyboard && <span className={`ws-chip${board?.storyboard.status === "APPROVED" ? " good" : ""}`}>Storyboard revision {timeline.storyboard.revision}{board && board.storyboard.status !== "APPROVED" ? ", waiting for Design" : ""}</span>}
            <span className={`ws-save is-${saveState === "saving" ? "saving" : saveState}`} role="status">{SAVE_WORDS[saveState]}{saveState === "conflict" && <button type="button" onClick={() => refresh()}>Reload</button>}</span>
          </span>
        </div>
      </div>
      {adding && <div className="ws-banner quiet"><NewPiece inline projectId={projectId} view={view} openStoryboards={openStoryboards} onStarted={(p) => { setAdding(false); choosePiece(p.id); refresh(); }} /></div>}
      {view.copy.source === "none" && <p className="ws-banner warn">No copy deck is approved for this project yet, so the slots show what they are for and v4 will not render them. Content writes the words in a plan.</p>}
      {refused && (
        <section className="ws-banner warn st-refused" aria-label="Refused by v4">
          <p><Lock size={13} /> {refused.message}</p>
          {refused.asked
            ? <p>Sent to Design as a change request on this element. It is in the Workshop&apos;s feedback.</p>
            : <AskDesign projectId={projectId} nodeId={refused.nodeId} pieceName={piece.timeline.timelineId} onSent={() => setRefused({ ...refused, asked: true })} onCancel={() => setRefused(null)} />}
        </section>
      )}

      <div className="ws-main st-main">
        <aside className="ws-left" aria-label="Elements">
          <div className="ws-tabs"><button type="button" className="active">Elements</button></div>
          <div className="ws-tabpanel">
            <p className="ws-note">The elements of <b>{frame?.label ?? sceneId}</b>. A locked one is Design&apos;s; moving it is a change to the design.</p>
            <ul className="st-nodes">
              {(frame?.nodes ?? []).map((n) => {
                const moves = timeline.tracks.some((k) => k.nodeId === n.id);
                return (
                  <li key={n.id}>
                    <button type="button" className="ws-layer" aria-pressed={selection?.kind === "node" && selection.id === n.id} onClick={() => { setSelection({ kind: "node", id: n.id }); setTab("edit"); }}>
                      {n.slotKey ? <Type size={12} aria-hidden="true" /> : <span className="st-dot" aria-hidden="true" />}
                      <span>{roleWords(n.role)}</span>
                      {n.locked && <Lock size={11} aria-label="locked" />}
                      {moves && <span className="ws-chip">moves</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <section className="ws-center" aria-label="Preview">
          <Preview projectId={projectId} pieceId={piece.id} hash={hash} output={output} frameWidth={frame?.width ?? output.width} at={at} />
          <Transport timeline={timeline} at={at} setAt={setAt} playing={playing} setPlaying={setPlaying} />
          <Lanes timeline={timeline} scenes={scenes} script={view.script} at={at} setAt={setAt} selection={selection} select={(s) => { setSelection(s); setTab("edit"); }} />
        </section>

        <aside className="ws-inspector" aria-label="Inspector">
          <div className="ws-tabs" role="tablist" aria-label="Inspector">
            <button role="tab" type="button" aria-selected={tab === "edit"} className={tab === "edit" ? "active" : ""} onClick={() => setTab("edit")}>Edit</button>
            <button role="tab" type="button" aria-selected={tab === "checks"} className={tab === "checks" ? "active" : ""} onClick={() => setTab("checks")}>Checks{problems.length ? ` (${problems.length})` : ""}</button>
          </div>
          <div className="ws-tabpanel" role="tabpanel">
            {tab === "edit"
              ? <Edit timeline={timeline} view={view} selection={selection} node={node} write={write} select={setSelection} />
              : <Checks projectId={projectId} problems={problems} renders={renders} timelineHash={hash} />}
          </div>
        </aside>
      </div>
      {toast && <p className="ws-toast" role="status">{toast}</p>}
    </div>
  );
}

/** The change goes to Design as a change request on the element, in the Workshop's own feedback: the studio never edits the design. */
function AskDesign({ projectId, nodeId, pieceName, onSent, onCancel }: { projectId: string; nodeId: string; pieceName: string; onSent: () => void; onCancel: () => void }) {
  const ds = useDataSource();
  const [text, setText] = useState(`From the Media studio (${pieceName}): this element is locked in the design. Can it move in the video, or should the motion stay off it?`);
  const [msg, setMsg] = useState<string | null>(null);
  const send = async () => {
    const r = await ds.design.annotate(projectId, { target: { kind: "NODE", id: nodeId }, kind: "CHANGE_REQUEST", text: text.trim() });
    if (r.error) { setMsg(r.error.message); return; }
    onSent();
  };
  return (
    <div className="st-ask">
      <Field label="What to ask Design"><textarea rows={2} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} /></Field>
      <div className="ws-actions"><Button variant="ghost" className="ws-btn" onClick={onCancel}>Leave it</Button><Button className="ws-btn primary" disabled={!text.trim() || !nodeId} onClick={() => void send()}>Ask Design</Button></div>
      {msg && <p className="mmsg" role="status">{msg}</p>}
    </div>
  );
}

/**
 * v4's preview page, in a frame with an opaque origin, told where to be by message. The page lays itself out at the frame's width,
 * as the renderer does, then shows the output; the box here only scales it to the room there is.
 */
function Preview({ projectId, pieceId, hash, output, frameWidth, at }: { projectId: string; pieceId: string; hash: string; output: MediaTimeline["outputs"][number]; frameWidth: number; at: number }) {
  const ds = useDataSource();
  const page = useQuery({ queryKey: ["media-preview", projectId, pieceId, hash, output.id, output.width, output.height], queryFn: async () => { const r = await ds.media.preview(projectId, pieceId, output.id); if (r.error) throw new Error(r.error.message); return r.data!; } });
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Ready is said by the page itself, for the page it is: a new page is not ready until it says so too.
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const ready = !!page.data && readyFor === page.data;
  const [room, setRoom] = useState(640);
  useEffect(() => {
    const shown = page.data ?? null;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      if ((e.data as { mediaPreview?: unknown } | null)?.mediaPreview === "ready") setReadyFor(shown);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [page.data]);
  useEffect(() => { if (ready) frameRef.current?.contentWindow?.postMessage({ seek: at }, "*"); }, [at, ready]);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRoom(Math.max(160, el.clientWidth - 32)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = Math.min(room / output.width, 420 / output.height);
  return (
    <div className="st-stage" ref={boxRef}>
      <div className="st-screen" style={{ width: output.width * scale, height: output.height * scale }} data-ready={ready || undefined}>
        {page.data && <iframe ref={frameRef} title="Preview" sandbox="allow-scripts" srcDoc={page.data}
          style={{ width: ready ? output.width : frameWidth, height: output.height, transform: `scale(${scale})` }} />}
        {page.isError && <p className="st-screen-note">{(page.error as Error).message}</p>}
      </div>
      <p className="st-caption">Preview from v4&apos;s own page. The file itself is made by the worker.</p>
    </div>
  );
}

function Transport({ timeline, at, setAt, playing, setPlaying }: { timeline: MediaTimeline; at: number; setAt: (ms: number) => void; playing: boolean; setPlaying: (p: boolean) => void }) {
  const raf = useRef(0);
  const atRef = useRef(at);
  useEffect(() => { atRef.current = at; }, [at]);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const next = atRef.current + (now - last);
      last = now;
      if (next >= timeline.durationMs) { setAt(timeline.durationMs); setPlaying(false); return; }
      setAt(next);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, timeline.durationMs, setAt, setPlaying]);
  return (
    <div className="st-transport">
      <button type="button" className="ws-ibtn" aria-label={playing ? "Pause" : "Play"} onClick={() => { if (!playing && at >= timeline.durationMs) setAt(0); setPlaying(!playing); }}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
      <input type="range" aria-label="Playhead" min={0} max={timeline.durationMs} step={1000 / timeline.fps} value={at} onChange={(e) => { setPlaying(false); setAt(e.target.valueAsNumber); }} />
      <span className="st-time">{(at / 1000).toFixed(2)} / {(timeline.durationMs / 1000).toFixed(2)} s</span>
    </div>
  );
}

/** The timeline: beats end to end, the script's lines under them, then a lane for each element that moves, with the playhead across them. */
function Lanes({ timeline, scenes, script, at, setAt, selection, select }: { timeline: MediaTimeline; scenes: MediaStudioFrame[]; script: MediaStudioView["script"]; at: number; setAt: (ms: number) => void; selection: Selection; select: (s: Selection) => void }) {
  const pct = (ms: number) => `${(ms / timeline.durationMs) * 100}%`;
  const roleOf = (id: string) => roleWords(scenes.flatMap((f) => f.nodes).find((n) => n.id === id)?.role ?? id);
  const textOf = (key: string) => script.find((l) => l.key === key)?.text;
  return (
    <div className="st-lanes" aria-label="Timeline">
      <div className="st-lane st-beats" role="group" aria-label="Beats">
        {timeline.beats.map((b) => {
          const x = timeline.transitions.find((t) => t.fromBeatId === b.id);
          return (
            <button key={b.id} type="button" className="st-beat" style={{ left: pct(b.startMs), width: pct(b.endMs - b.startMs) }} aria-pressed={selection?.kind === "beat" && selection.id === b.id}
              aria-label={`Beat ${b.label}, ${seconds(b.startMs)} to ${seconds(b.endMs)}`} onClick={() => { select({ kind: "beat", id: b.id }); setAt(b.startMs); }}>
              <span>{b.label}</span>
              {x && x.durationMs > 0 && <i className="st-handover" style={{ width: `${(x.durationMs / (b.endMs - b.startMs)) * 100}%` }} title={`${words(x.preset)}, ${x.durationMs} ms`} />}
            </button>
          );
        })}
      </div>
      {timeline.script.length > 0 && (
        <div className="st-lane st-script" role="group" aria-label="Script">
          <span className="st-lane-name">Script</span>
          {timeline.script.map((l) => (
            <button key={l.key} type="button" className="st-line" style={{ left: pct(l.startMs), width: pct(l.endMs - l.startMs) }} data-now={lineAt(timeline, at)?.key === l.key || undefined}
              aria-label={`Script line ${l.key}, ${seconds(l.startMs)} to ${seconds(l.endMs)}`} title={textOf(l.key) ?? `${l.key} has no approved words yet`} onClick={() => setAt(l.startMs)}>
              <span>{textOf(l.key) ?? l.key}</span>
            </button>
          ))}
        </div>
      )}
      {timeline.tracks.map((k) => {
        const start = k.startMs ?? k.keyframes[0]?.atMs ?? 0;
        const end = k.durationMs !== null ? start + k.durationMs : k.keyframes.at(-1)?.atMs ?? start;
        return (
          <div key={k.nodeId} className="st-lane">
            <span className="st-lane-name">{roleOf(k.nodeId)}</span>
            <button type="button" className="st-bar" style={{ left: pct(start), width: pct(Math.max(end - start, timeline.durationMs / 200)) }} aria-pressed={selection?.kind === "node" && selection.id === k.nodeId}
              aria-label={`${roleOf(k.nodeId)}: ${k.preset ? words(k.preset) : "keyframes"} from ${seconds(start)}`} onClick={() => { select({ kind: "node", id: k.nodeId }); setAt(start); }} />
          </div>
        );
      })}
      <div className="st-playhead" style={{ left: `calc(16px + ${at / timeline.durationMs} * (100% - 32px))` }} aria-hidden="true" />
    </div>
  );
}

function Edit({ timeline, view, selection, node, write, select }: { timeline: MediaTimeline; view: MediaStudioView; selection: Selection; node: MediaStudioFrame["nodes"][number] | undefined; write: (t: MediaTimeline, touched?: string) => void; select: (s: Selection) => void }) {
  const { presets } = view;
  if (selection?.kind === "beat") {
    const beat = timeline.beats.find((b) => b.id === selection.id);
    if (!beat) return null;
    const i = timeline.beats.indexOf(beat);
    const next = timeline.beats[i + 1];
    const x = timeline.transitions.find((t) => t.fromBeatId === beat.id);
    const range = presets.transition.find((p) => p.name === (x?.preset ?? "cut"));
    return (
      <Section title={`Beat: ${beat.label}`}>
        <Num label="Length" suffix="s" step={0.1} min={0.1} value={(beat.endMs - beat.startMs) / 1000} onChange={(v) => write(setBeatLength(timeline, beat.id, v * 1000))} />
        <p className="ws-note">Everything inside the beat stretches with it; what comes after moves by the difference.</p>
        {next && <>
          <Field label={`Hand-over to ${next.label}`}>
            <select value={x?.preset ?? "cut"} onChange={(e) => { const p = presets.transition.find((r) => r.name === e.target.value)!; write(setTransition(timeline, beat.id, p.name as TransitionPreset, p.defaultMs)); }}>
              {presets.transition.map((p) => <option key={p.name} value={p.name}>{words(p.name)}</option>)}
            </select>
          </Field>
          {x && x.preset !== "cut" && range && <Num label="Hand-over length" suffix="ms" step={50} min={range.minMs} max={range.maxMs} value={x.durationMs} onChange={(v) => write(setTransition(timeline, beat.id, x.preset, v))} />}
          {range && range.maxMs > 0 && <small className="wf-hint">{words(range.name)} takes {range.minMs} to {range.maxMs} ms.</small>}
        </>}
      </Section>
    );
  }
  if (selection?.kind === "node" && node) {
    const track = timeline.tracks.find((k) => k.nodeId === node.id);
    const preset = track?.preset ?? null;
    const range = presets.node.find((p) => p.name === preset);
    const set = (p: { preset: NodePreset; startMs: number; durationMs: number } | null) => write(setTrack(timeline, node.id, p), node.id);
    return (
      <Section title={roleWords(node.role)}>
        {node.locked && <p className="ws-warn"><Lock size={12} /> Design locked this element. v4 refuses motion on it; the studio can ask Design instead.</p>}
        {node.slotKey && <p className="ws-note">Shows the words of slot <b>{node.slotKey}</b>{view.copy.words[node.slotKey] ? <>: &ldquo;{view.copy.words[node.slotKey]}&rdquo;</> : ", which has no approved words yet"}.</p>}
        <Field label="Motion">
          <select value={preset ?? ""} onChange={(e) => {
            const p = presets.node.find((r) => r.name === e.target.value);
            set(p ? { preset: p.name as NodePreset, startMs: track?.startMs ?? 0, durationMs: Math.min(p.maxMs, Math.max(p.minMs, track?.durationMs ?? p.defaultMs)) } : null);
          }}>
            <option value="">None</option>
            {presets.node.map((p) => <option key={p.name} value={p.name}>{words(p.name)}</option>)}
          </select>
        </Field>
        {track && preset && range && <>
          <Num label="Starts at" suffix="s" step={0.05} min={0} max={timeline.durationMs / 1000} value={(track.startMs ?? 0) / 1000} onChange={(v) => set({ preset, startMs: v * 1000, durationMs: track.durationMs ?? range.defaultMs })} />
          <Num label="Lasts" suffix="ms" step={50} min={range.minMs} max={range.maxMs} value={track.durationMs ?? range.defaultMs} onChange={(v) => set({ preset, startMs: track.startMs ?? 0, durationMs: v })} />
          <small className="wf-hint">{words(range.name)} takes {range.minMs} to {range.maxMs} ms.</small>
        </>}
      </Section>
    );
  }
  if (selection?.kind === "output") {
    const o = timeline.outputs.find((x) => x.id === selection.id);
    if (!o) return null;
    const shape = OUTPUT_SHAPES.find((s) => s.width === o.width && s.height === o.height);
    return (
      <Section title={o.destination}>
        <Field label="Shape">
          <select value={shape?.label ?? "custom"} onChange={(e) => { const s = OUTPUT_SHAPES.find((x) => x.label === e.target.value); if (s) write(setOutput(timeline, o.id, { width: s.width, height: s.height })); }}>
            {OUTPUT_SHAPES.map((s) => <option key={s.label} value={s.label}>{s.label} ({s.width}x{s.height})</option>)}
            {!shape && <option value="custom">{o.width}x{o.height}</option>}
          </select>
        </Field>
        {isStill(o) && <Num label="The moment it shows" suffix="s" step={0.05} min={0} max={timeline.durationMs / 1000} value={(o.atMs ?? 0) / 1000} onChange={(v) => write(setOutput(timeline, o.id, { atMs: v * 1000 }))} />}
        <p className="ws-note">{isStill(o) ? "A still is one moment of the piece." : `Plays the whole piece at ${timeline.fps} frames a second.`} Format {o.format.toUpperCase()}.</p>
      </Section>
    );
  }
  return (
    <Section title="The piece">
      <p className="ws-note">{seconds(timeline.durationMs)} at {timeline.fps} frames a second, in {timeline.beats.length} beats{timeline.template ? `, started from the ${timeline.template.id} template` : ""}. Pick a beat or an element to change it.</p>
      {timeline.script.length > 0 && <>
        <h4 className="st-sub">Captions</h4>
        <label className="ws-check"><input type="checkbox" checked={timeline.captions.burnIn} onChange={(e) => write(setCaptions(timeline, { burnIn: e.target.checked }))} /> Burn the script into the picture</label>
        <label className="ws-check"><input type="checkbox" checked={timeline.captions.webvtt} onChange={(e) => write(setCaptions(timeline, { webvtt: e.target.checked }))} /> Write a WebVTT captions file</label>
        <p className="ws-note">The words are the copy deck&apos;s script lines; Content writes them, and each line plays over its beat.</p>
      </>}
      <h4 className="st-sub">Outputs</h4>
      <ul className="st-outputs">{timeline.outputs.map((o) => <li key={o.id}><button type="button" className="ws-layer" onClick={() => select({ kind: "output", id: o.id })}>{o.destination}<span className="ws-chip">{o.width}x{o.height} {o.format}</span></button></li>)}</ul>
    </Section>
  );
}

function Checks({ projectId, problems, renders, timelineHash }: { projectId: string; problems: string[]; renders: MediaStudioRender[]; timelineHash: string }) {
  const ds = useDataSource();
  const [msg, setMsg] = useState<string | null>(null);
  const download = async (assetId: string) => {
    const r = await ds.assets.downloadLink(assetId);
    if (r.error || !r.data) { setMsg(r.error?.message ?? "No download yet."); return; }
    window.open(r.data.url, "_blank", "noopener");
  };
  return (
    <>
      <Section title="Before a render">
        {problems.length
          ? <><p className="ws-warn">v4 will not render this yet:</p><ul className="st-list">{problems.map((p) => <li key={p}>{p}</li>)}</ul></>
          : <p className="ws-note">Nothing stops a render against the approved design.</p>}
      </Section>
      {renders.length === 0 && <p className="ws-note">No render yet. Render asks v4&apos;s worker for the file; its checks appear here.</p>}
      {renders.map((r, i) => (
        <article key={r.id} className="st-render" aria-label={`Render ${renders.length - i}`}>
          <header>
            <b>{r.outputId}</b>
            <span className={`ws-chip${r.status === "RENDERED" ? " good" : r.status === "FAILED" || r.status === "REFUSED" ? " bad" : ""}`}>{STATUS_WORDS[r.status]}</span>
            {r.timelineHash !== timelineHash && <span className="ws-chip">an earlier edit</span>}
          </header>
          {r.problems.length > 0 && <ul className="st-list">{r.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          {r.checks.length > 0 && <ol className="st-ladder" aria-label="Checks">
            {r.checks.map((c) => (
              <li key={c.id} data-gate={c.gate}>
                <div><b>{CHECK_WORDS[c.id]}</b><span className={`ws-chip${c.gate === "PASSED" ? " good" : c.gate === "FAILED" ? " bad" : ""}`}>{GATE_WORDS[c.gate]}</span>{c.advisory && <span className="ws-chip">advisory</span>}</div>
                <p>{c.summary}</p>
                {(c.details.length > 0 || c.notMeasured.length > 0) && <details><summary>Details</summary><ul className="st-list">{c.details.map((d) => <li key={d}>{d}</li>)}{c.notMeasured.map((d) => <li key={d} className="st-nm">Not judged here: {d}</li>)}</ul></details>}
              </li>
            ))}
          </ol>}
          {r.frameSheet.length > 0 && <div className="st-sheet" aria-label="Frame sheet">{r.frameSheet.map((f) => (
            <figure key={f.index}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a frame sheet picture is served by v4 through the proxy, with the session; it is not an asset Next can optimise */}
              <img src={ds.media.sheetUrl(projectId, r.id, f.index)} alt={`${f.label}, at ${(f.atMs / 1000).toFixed(2)} s`} loading="lazy" />
              <figcaption>{f.label}</figcaption>
            </figure>
          ))}</div>}
          {r.asset && <Button variant="ghost" className="ws-btn" onClick={() => void download(r.asset!.assetId)}><Download size={14} /> Download the newest file</Button>}
        </article>
      ))}
      {msg && <p className="mmsg" role="status">{msg}</p>}
    </>
  );
}
