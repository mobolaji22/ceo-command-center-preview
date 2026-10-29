"use client";

import { Download, Grid3x3, Magnet, MessageSquarePlus, MoreHorizontal, MousePointer2, PanelLeft, PanelRight, Redo2, Send, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth";
import { useDataSource } from "@/lib/data";
import type { Op } from "@/lib/design/edit";
import { choosing, type AnnotationTarget, type SddVersion } from "@/lib/design/v4";
import type { ClientData, OwnerData } from "@/lib/model";
import { Empty } from "../views";
import { projectsIn } from "../corridor";
import { useDomains } from "@/lib/domains";
import { useStepUp } from "../step-up";
import { Artboard } from "./canvas";
import { Directions } from "./directions";
import { Inspector, type InspectorTab } from "./inspector";
import { LeftPanel, viewportWords, type LeftTab } from "./left-panel";
import { useWorkshop } from "./use-workshop";

/**
 * The Design Workshop: a light design tool over v4's design document (ADR-0051). The agency adjusts the chosen direction (tokens,
 * type, layout, colour) and sends it for a decision; the client's owner sees what they may, leaves typed feedback, and decides. It
 * edits the document, never a picture of it, and every rule (who may edit, annotate, answer or approve) is v4's.
 */
export function WorkshopDesk({ data, dept }: { data: OwnerData; dept: string }) {
  const { list } = useDomains();
  const projects = projectsIn(data, dept, list);
  const [pid, setPid] = useState(projects[0]?.id ?? "");
  const project = projects.find((p) => p.id === pid) ?? projects[0];
  if (!project) return <div className="workshop-empty"><Empty title="No design project yet.">The Workshop opens a project that has design work. Issue a directive for one from the office.</Empty></div>;
  const picker = projects.length > 1 ? <select className="ws-select" aria-label="Design project" value={project.id} onChange={(e) => setPid(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select> : <b className="ws-project">{project.name}</b>;
  return <DesignWorkshop key={project.id} projectId={project.id} projectName={project.name} picker={picker} />;
}

/** The client's way into the same Workshop: their own projects, one at a time. What they may see and do is v4's to decide. */
export function ClientDesignDesk({ data, initialProjectId }: { data: ClientData; initialProjectId?: string | undefined }) {
  const [pid, setPid] = useState(data.projects.find((p) => p.id === initialProjectId)?.id ?? data.projects[0]?.id ?? "");
  const project = data.projects.find((p) => p.id === pid) ?? data.projects[0];
  if (!project) return <div className="workshop-empty"><Empty title="No project yet.">The design opens here once the agency starts design work for you.</Empty></div>;
  const picker = data.projects.length > 1 ? <select className="ws-select" aria-label="Design project" value={project.id} onChange={(e) => setPid(e.target.value)}>{data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select> : <b className="ws-project">{project.name}</b>;
  return <DesignWorkshop key={project.id} projectId={project.id} projectName={project.name} picker={picker} />;
}

const download = (filename: string, content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "design";

/** One project's design, for the agency or for a client: the same canvas, with what each may do. */
export function DesignWorkshop({ projectId, projectName, picker }: { projectId: string; projectName: string; picker: React.ReactNode }) {
  const auth = useAuth();
  const agency = auth.isOwner;
  const ds = useDataSource();
  const w = useWorkshop(projectId, agency);
  const doc = w.doc;
  const [activeTerr, setActiveTerr] = useState<string | null>(null);
  const [activeFrame, setActiveFrame] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  // Who is looking may still be loading when the Workshop opens, so the starting tool and tab follow it until the person picks one.
  const [toolPick, setTool] = useState<"select" | "comment" | null>(null);
  const tool = toolPick ?? (agency ? "select" : "comment");
  const [snap, setSnap] = useState(true);
  const [grid, setGrid] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>("layers");
  const [tabPick, setRightTab] = useState<InspectorTab | null>(null);
  const rightTab = tabPick ?? (agency ? "design" : "feedback");
  const [toast, setToast] = useState<string | null>(null);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [target, setTarget] = useState<AnnotationTarget>({ kind: "DOCUMENT", id: null });
  const [fit, setFit] = useState(0.5);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [confirming, setConfirming] = useState(false);
  // On a phone (P6.21 P6) the Workshop shows one pane at a time; the inspector opens as a sheet over the canvas.
  const phone = useIsMobile();
  const [pane, setPane] = useState<"directions" | "canvas">("canvas");
  const [more, setMore] = useState(false);
  const [sheet, setSheet] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef(0);

  const say = (m: string) => { setToast(m); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(null), 4200); };
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  const versionsQ = useQuery({ queryKey: ["sdd-versions", projectId], queryFn: async () => (await ds.design.versions(projectId)).data ?? [] });
  const versions: SddVersion[] = versionsQ.data ?? [];
  const listVersions = () => versionsQ.refetch();

  const terrId = doc ? (activeTerr && doc.territories.some((t) => t.id === activeTerr) ? activeTerr : (doc.selectedTerritoryId ?? doc.territories[0]?.id ?? null)) : null;
  const frames = doc ? doc.frames.filter((f) => f.territoryId === terrId && f.width) : [];
  const frame = frames.find((f) => f.id === activeFrame) ?? frames[0];
  const valid = doc && frame ? selection.filter((id) => frame.nodeIds.includes(id)) : [];

  // Fit the frame's width to the room the canvas has; a tall page scrolls.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !frame?.width) return;
    const fw = frame.width;
    const calc = () => setFit(Math.max(0.15, Math.min(1, (el.clientWidth - (phone ? 24 : 48)) / fw)));
    calc();
    const ro = new ResizeObserver(calc); ro.observe(el);
    return () => ro.disconnect();
  }, [frame, phone]);
  const scale = zoom === "fit" ? fit : zoom;
  const stepZoom = (dir: 1 | -1) => setZoom(Math.max(0.15, Math.min(2, Math.round((scale + dir * 0.1) * 10) / 10)));

  const run = (op: Op, opts?: { coalesce?: string }) => { const m = w.commit(op, opts); if (m) say(m); if (!m && op.type === "DELETE") setSelection([]); };
  const point = (nodeId: string | null) => {
    if (!frame) return;
    setTarget(nodeId ? { kind: "NODE", id: nodeId } : { kind: "FRAME", id: frame.id });
    if (nodeId) setSelection([nodeId]);
    setRightTab("feedback"); if (phone) setSheet(true);
  };

  const onKey = (e: RKeyboardEvent<HTMLDivElement>) => {
    const tg = e.target as HTMLElement;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); if (e.shiftKey) w.redo(); else w.undo(); return; }
    if (mod && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); w.redo(); return; }
    if (typing || !w.editable) return;
    if (mod && e.key.toLowerCase() === "d" && valid.length) { e.preventDefault(); run({ type: "DUPLICATE", ids: valid }); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && valid.length) { e.preventDefault(); run({ type: "DELETE", ids: valid }); return; }
    if (e.key === "Escape" && valid.length) { e.stopPropagation(); setSelection([]); }
  };

  if (w.loadError) return <div className="workshop-empty"><Empty title="The design could not be opened."><p>{w.loadError}</p><Button variant="ghost" className="ws-btn" onClick={() => void w.reload()}>Try again</Button></Empty></div>;
  if (!w.view) return <div className="workshop-empty"><span className="pulse-dot" /> Opening the design…</div>;
  if (!doc) return <div className="workshop-empty"><Empty title="No design to show yet.">{agency ? "The design document appears here once the design work has drawn its directions." : "The design appears here once the agency sends it to you for a decision."}</Empty></div>;
  // While a direction is still to be chosen, the Workshop is where the choice is made: the directions side by side.
  if (choosing(doc)) return <div className="workshop workshop-directions"><div className="ws-toolbar">{picker}</div><div className="directions-scroll"><Directions projectId={projectId} onChosen={agency ? () => void w.reload() : undefined} /></div></div>;
  if (!frame) return <div className="workshop-empty"><Empty title="Nothing laid out yet.">This direction has no frame with a size yet, so there is nothing to draw.</Empty></div>;

  const v = w.view;
  const submitted = v.current?.status === "SUBMITTED";
  const where = submitted ? `Revision ${doc.revision}, waiting for a decision` : v.current ? `Draft of revision ${doc.revision}` : v.approved ? `Version ${v.approved.version}, approved` : `Revision ${doc.revision}`;
  const saveText = w.saveState === "saving" ? "Saving…" : w.saveState === "unsaved" ? "Unsaved changes" : w.saveState === "failed" ? "Could not save" : w.saveState === "conflict" ? "Out of date" : "Saved";
  const openRequests = doc.annotations.filter((a) => a.kind === "CHANGE_REQUEST" && a.status === "OPEN").length;
  const saveStatus = <span className="ws-status"><span className="ws-chip">{where}</span>{w.editable && <span className={`ws-save is-${w.saveState}`} role="status">{saveText}{w.saveState === "failed" && <button type="button" onClick={() => void w.retrySave()}>Retry</button>}{w.saveState === "conflict" && <button type="button" onClick={() => void w.reload()}>Reload</button>}</span>}</span>;

  const submit = async () => {
    const m = await w.submit();
    setConfirming(false);
    say(m ?? "Sent for a decision. It stays as it is until the client decides.");
  };

  return (
    <div className="workshop" data-desk="workshop" onKeyDown={onKey}>
      <div className="ws-toolbar" role="toolbar" aria-label="Workshop tools" data-more={more || undefined}>
        <div className="ws-tb-top">{picker}{phone && saveStatus}</div>
        <div className="ws-tb-tools">
          {w.editable && <div className="ws-group"><button type="button" className="ws-ibtn" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!w.canUndo} onClick={w.undo}><Undo2 size={15} /></button><button type="button" className="ws-ibtn" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!w.canRedo} onClick={w.redo}><Redo2 size={15} /></button></div>}
          <div className="ws-group">
            {w.editable && <button type="button" className="ws-ibtn" aria-label="Select tool" title="Select" aria-pressed={tool === "select"} onClick={() => setTool("select")}><MousePointer2 size={15} /></button>}
            <button type="button" className="ws-ibtn" aria-label="Feedback tool" title="Point at an element to leave feedback on it" aria-pressed={tool === "comment"} onClick={() => { setTool(tool === "comment" && w.editable ? "select" : "comment"); setRightTab("feedback"); }}><MessageSquarePlus size={15} /></button>
          </div>
          <div className="ws-group"><button type="button" className="ws-ibtn" aria-label="Zoom out" onClick={() => stepZoom(-1)}><ZoomOut size={15} /></button><button type="button" className="ws-zoom" onClick={() => setZoom("fit")} aria-label="Fit to screen" title="Fit to screen">{Math.round(scale * 100)}%</button><button type="button" className="ws-ibtn" aria-label="Zoom in" onClick={() => stepZoom(1)}><ZoomIn size={15} /></button></div>
          {!phone && <div className="ws-group"><button type="button" className="ws-ibtn" aria-label="Directions and layers panel" title="Show or hide the directions and layers" aria-pressed={showLeft} onClick={() => setShowLeft((x) => !x)}><PanelLeft size={15} /></button><button type="button" className="ws-ibtn" aria-label="Inspector panel" title="Show or hide the inspector" aria-pressed={showRight} onClick={() => setShowRight((x) => !x)}><PanelRight size={15} /></button></div>}
          {w.editable && <div className="ws-group ws-extra"><button type="button" className="ws-ibtn" aria-label="Snap to guides" title="Snap to guides and the spacing grid" aria-pressed={snap} onClick={() => setSnap(!snap)}><Magnet size={15} /></button><button type="button" className="ws-ibtn" aria-label="Show grid" title="Show the grid" aria-pressed={grid} onClick={() => setGrid(!grid)}><Grid3x3 size={15} /></button></div>}
          <div className="ws-group ws-extra"><Button variant="ghost" className="ws-btn" onClick={() => download(`${slug(projectName)}-design-r${doc.revision}.json`, JSON.stringify(doc, null, 2))}><Download size={14} /> Data</Button></div>
          {w.editable && v.current && <Button className="ws-btn primary" disabled={w.saveState === "saving"} onClick={() => setConfirming(true)}><Send size={14} /> Send for decision</Button>}
          <button type="button" className="ws-ibtn ws-more" aria-label="More tools" aria-expanded={more} onClick={() => setMore((m) => !m)}><MoreHorizontal size={15} /></button>
          {!phone && saveStatus}
        </div>
      </div>
      <Banner agency={agency} view={v} openRequests={openRequests} approvedVersion={v.approved?.version ?? null} />
      {!agency && submitted && v.current && <Decide proposalId={v.current.proposalId} openRequests={openRequests} done={(m) => { say(m); void w.reload(); void listVersions(); }} />}
      {w.saveNote && <p className="ws-banner warn">{w.saveNote}</p>}

      <div className="ws-main" data-pane={phone ? pane : undefined} data-sheet={phone && sheet ? "" : undefined} data-no-left={!phone && !showLeft ? "" : undefined} data-no-right={!phone && !showRight ? "" : undefined}>
        <LeftPanel doc={doc} tab={leftTab} setTab={setLeftTab} territoryId={terrId} setTerritory={(id) => { setActiveTerr(id); setActiveFrame(null); setSelection([]); if (phone) setPane("canvas"); }} frameId={frame.id} setFrame={setActiveFrame} selection={valid} setSelection={setSelection} run={run} editable={w.editable} />

        <section className="ws-center" aria-label="Canvas">
          <div className="ws-context">
            <b>{doc.territories.find((t) => t.id === terrId)?.concept ?? "Design"}</b>
            <div className="ws-seg" role="group" aria-label="Frame">{frames.map((f) => <button key={f.id} type="button" aria-pressed={f.id === frame.id} onClick={() => { setActiveFrame(f.id); setSelection([]); }}>{viewportWords(f.viewport)}</button>)}</div>
          </div>
          <div className={`ws-stage${tool === "comment" ? " is-commenting" : ""}`} ref={stageRef}>
            <Artboard doc={doc} frameId={frame.id} scale={scale} selection={valid} onSelect={setSelection} onOp={w.editable ? (op, o) => w.commit(op, o) : undefined} tool={tool} snap={snap} grid={grid} readOnly={!w.editable} onRefuse={say}
              activePin={activePin} onPinClick={(id) => { setActivePin(id); setRightTab("feedback"); if (phone) setSheet(true); }} onPin={point} />
          </div>
        </section>

        {phone && sheet && <button type="button" className="ws-sheet-close" onClick={() => setSheet(false)}>Done</button>}
        <Inspector doc={doc} frameId={frame.id} selection={valid} setSelection={setSelection} run={run} tab={rightTab} setTab={setRightTab} editable={w.editable} agency={agency} me={auth.user?.userId ?? null}
          activePin={activePin} setActivePin={setActivePin} target={target} setTarget={setTarget} annotate={w.annotate} settle={w.settle} versions={versions}
          restore={(n) => void w.restore(n).then((m) => say(m ?? `Version ${n} is the draft again. Undo takes it back.`))} say={say} />
      </div>

      {phone && <div className="ws-panes" role="tablist" aria-label="Workshop panes">
        {(["directions", "canvas"] as const).map((p) => <button key={p} type="button" role="tab" aria-selected={pane === p} onClick={() => { setPane(p); setSheet(false); }}>{p === "directions" ? "Layers" : "Canvas"}</button>)}
        {pane === "canvas" && <button type="button" className="ws-edit-open" aria-expanded={sheet} onClick={() => setSheet(true)}>{w.editable ? (valid.length ? `Edit (${valid.length})` : "Edit") : "Feedback"}</button>}
      </div>}
      {toast && <p className="ws-toast" role="status">{toast}</p>}

      {confirming && (
        <div className="ws-dialog-wrap" onClick={() => setConfirming(false)}>
          <div className="ws-dialog" role="dialog" aria-modal="true" aria-label="Send for a decision" onClick={(e) => e.stopPropagation()}>
            <h3>Send revision {doc.revision} for a decision?</h3>
            <p className="ws-note">The client&apos;s owner sees it and decides. Until they do, it cannot change.{openRequests ? ` ${openRequests} change request${openRequests === 1 ? " is" : "s are"} still open, so it cannot be approved until ${openRequests === 1 ? "it is" : "they are"} answered.` : ""}</p>
            <div className="ws-actions"><Button variant="ghost" className="ws-btn" onClick={() => setConfirming(false)}>Cancel</Button><Button className="ws-btn primary" onClick={() => void submit()}>Send for decision</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Where the design stands, said once, for whoever is looking. */
function Banner({ agency, view: v, openRequests, approvedVersion }: { agency: boolean; view: NonNullable<ReturnType<typeof useWorkshop>["view"]>; openRequests: number; approvedVersion: number | null }) {
  const submitted = v.current?.status === "SUBMITTED";
  const text = agency
    ? submitted ? "Sent for a decision: it stays as it is until the client decides. Their answer, or a change they ask for, opens the next revision."
      : !v.current && approvedVersion ? `This is version ${approvedVersion}. Your first change starts the next revision; the approved version stays as it is.`
        : openRequests ? `${openRequests} change request${openRequests === 1 ? " is" : "s are"} open. Answer each before sending this revision for a decision.` : null
    : submitted ? "This revision is waiting for your decision. Look it over, then approve it or ask for a change."
      : approvedVersion ? `This is version ${approvedVersion}, as approved. Point at anything to leave feedback; the agency answers it in the next revision.` : null;
  return text ? <p className="ws-banner quiet">{text}</p> : null;
}

/** The client's owner decides a submitted revision: approve (with a fresh proof of who is deciding) or ask for a change. */
function Decide({ proposalId, openRequests, done }: { proposalId: string; openRequests: number; done: (message: string) => void }) {
  const ds = useDataSource();
  const { guard, panel } = useStepUp();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const decide = (action: "APPROVE" | "REQUEST_REVISION") => {
    setBusy(true); setMsg(null);
    void guard(() => ds.design.decide(proposalId, action === "APPROVE" ? { action } : { action, note: note.trim() }), (r) => {
      setBusy(false);
      if (r.error) { setMsg(r.error.message); return; }
      done(action === "APPROVE" ? "Approved. This is now the design the work follows." : "Sent back with your note. The agency works on the next revision.");
    }).finally(() => setBusy(false));
  };
  return (
    <section className="ws-decide" aria-label="Your decision">
      {openRequests > 0 && <p className="ws-warn">{openRequests} change request{openRequests === 1 ? " is" : "s are"} still open, so this cannot be approved yet.</p>}
      {asking
        ? <><label className="wf"><span className="wf-label">What should change?</span><textarea rows={2} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="ws-actions"><Button variant="ghost" className="ws-btn" disabled={busy} onClick={() => setAsking(false)}>Cancel</Button><Button className="ws-btn primary" disabled={busy || !note.trim()} onClick={() => decide("REQUEST_REVISION")}>Send back with this note</Button></div></>
        : <div className="ws-actions"><Button className="ws-btn primary" disabled={busy || openRequests > 0} onClick={() => decide("APPROVE")}>Approve this design</Button><Button variant="ghost" className="ws-btn" disabled={busy} onClick={() => setAsking(true)}>Ask for a change</Button></div>}
      {panel}
      {msg && <p className="mmsg" role="status">{msg}</p>}
    </section>
  );
}
