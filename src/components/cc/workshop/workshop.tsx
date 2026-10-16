"use client";

import { Download, Grid3x3, Magnet, MessageSquarePlus, MoreHorizontal, MousePointer2, Redo2, Undo2, Upload, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as RKeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth";
import { useDataSource } from "@/lib/data";
import { fail, ok } from "@/lib/data/types";
import { loadDraft, saveDraft } from "@/lib/design/draft-store";
import { documentJson, download, frameToSvg, slug } from "@/lib/design/export";
import type { Op } from "@/lib/design/ops";
import { FixtureProposalProvider, type Proposal, type ProposalKind } from "@/lib/design/proposals";
import { SDD_SCHEMA, territoryOf, type Checkpoint, type DesignDocument, type Territory } from "@/lib/design/sdd";
import type { OwnerData } from "@/lib/model";
import { Empty } from "../views";
import { projectsIn } from "../corridor";
import { useDomains } from "@/lib/domains";
import { Artboard } from "./canvas";
import { Inspector, type InspectorTab } from "./inspector";
import { LeftPanel, type LeftTab } from "./left-panel";
import { useWorkshop, type DesignStore } from "./use-workshop";

/**
 * The Design Workshop: a human control panel over the structured design document, in the shape of a light design tool. Pick the
 * direction that territory exploration produced, then adjust it: tokens, type, layout, copy, notes. It edits the document, never
 * a picture of it, so everything it does is attributable, undoable and exportable (Design Intelligence Contract v15, Stage 5).
 */
export function WorkshopDesk({ data, dept }: { data: OwnerData; dept: string }) {
  const { list } = useDomains();
  const projects = projectsIn(data, dept, list);
  const [pid, setPid] = useState(projects[0]?.id ?? "");
  const ds = useDataSource();
  const auth = useAuth();
  const actor = auth.user?.email ?? "CEO";
  const store: DesignStore = useMemo(
    () => ds.capabilities.designDocuments
      ? { where: "agency", load: ds.design.load, save: ds.design.save }
      : { where: "device", load: async (id) => ok(loadDraft(id)), save: async (doc) => (saveDraft(doc) ? ok({ revision: doc.revision }) : fail("This browser could not keep the design. Export it to be safe.", "STORAGE_FULL")) },
    [ds],
  );
  const project = projects.find((p) => p.id === pid) ?? projects[0];
  if (!project) return <div className="workshop-empty"><Empty title="No design project yet.">The Workshop opens a project that has design work. Issue a directive for one from the office.</Empty></div>;
  return (
    <WorkshopEditor key={project.id} projectId={project.id} projectName={project.name} actor={actor} store={store}
      picker={projects.length > 1 ? <select className="ws-select" aria-label="Design project" value={project.id} onChange={(e) => setPid(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select> : null} />
  );
}

type Dialog = { kind: "choose"; territory: Territory } | { kind: "restore"; checkpoint: Checkpoint } | { kind: "proposal"; proposal: Proposal; frameId: string } | null;

function WorkshopEditor({ projectId, projectName, actor, store, picker }: { projectId: string; projectName: string; actor: string; store: DesignStore; picker: React.ReactNode }) {
  const w = useWorkshop(projectId, projectName, actor, store);
  const doc = w.doc;
  const [activeTerr, setActiveTerr] = useState<string | null>(null);
  const [activeFrame, setActiveFrame] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [tool, setTool] = useState<"select" | "comment">("select");
  const [snap, setSnap] = useState(true);
  const [grid, setGrid] = useState(false);
  const [compare, setCompare] = useState(false);
  const [compareView, setCompareView] = useState<"desktop" | "mobile">("desktop");
  const [leftTab, setLeftTab] = useState<LeftTab>("directions");
  const [rightTab, setRightTab] = useState<InspectorTab>("design");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [fit, setFit] = useState(0.5);
  const [cmpW, setCmpW] = useState(260);
  // On a phone (P6.21 P6) the Workshop shows one pane at a time; selecting on the canvas opens Edit as a sheet over it.
  const phone = useIsMobile();
  const [pane, setPane] = useState<"directions" | "canvas">("canvas");
  const [more, setMore] = useState(false);
  const [bannerGone, setBannerGone] = useState(false);
  // The Edit sheet opens only from its own button: a touch on the canvas selects, it never opens anything by itself.
  const [sheet, setSheet] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef(0);

  const terrId = doc ? (activeTerr && doc.territories.some((t) => t.id === activeTerr) ? activeTerr : (doc.selectedTerritoryId ?? doc.territories[0]?.id ?? "")) : "";
  const frames = doc ? doc.frames.filter((f) => f.territoryId === terrId) : [];
  const frame = frames.find((f) => f.id === activeFrame) ?? frames[0];
  const valid = doc && frame ? selection.filter((id) => doc.nodes.some((n) => n.id === id && n.frameId === frame.id)) : [];

  const say = (m: string) => { setToast(m); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(null), 4200); };
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  const run = (op: Op, opts?: { coalesce?: string }) => { const m = w.commit(op, opts); if (m) say(m); if (!m && op.type === "DELETE") setSelection([]); };

  // Fit the frame to the room the canvas has.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !frame) return;
    // Comparing: three previews share the width the canvas has. Editing: the one frame fits the room.
    const calc = () => { setFit(Math.max(0.15, phone ? Math.min(1, (el.clientWidth - 24) / frame.w) : Math.min(1, (el.clientWidth - 56) / frame.w, (el.clientHeight - 56) / frame.h))); setCmpW(Math.max(150, Math.floor((el.clientWidth - 36 - 32) / 3 - 30))); };
    calc();
    const ro = new ResizeObserver(calc); ro.observe(el);
    return () => ro.disconnect();
  }, [frame, compare, phone]);
  const scale = zoom === "fit" ? fit : zoom;
  // Pinch to zoom on a phone: two fingers set the zoom; one finger still scrolls the canvas (P6.21 P6).
  const ready = Boolean(doc && frame);
  const scaleRef = useRef(scale);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => {
    const el = stageRef.current;
    if (!phone || compare || !el) return;
    let start: { d: number; scale: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const down = (e: TouchEvent) => { if (e.touches.length === 2) start = { d: dist(e.touches), scale: scaleRef.current }; };
    const move = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !start) return;
      e.preventDefault();
      setZoom(Math.max(0.2, Math.min(2, Math.round(start.scale * (dist(e.touches) / start.d) * 100) / 100)));
    };
    const up = (e: TouchEvent) => { if (e.touches.length < 2) start = null; };
    el.addEventListener("touchstart", down, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", up);
    return () => { el.removeEventListener("touchstart", down); el.removeEventListener("touchmove", move); el.removeEventListener("touchend", up); };
  }, [phone, compare, ready]);
  const stepZoom = (dir: 1 | -1) => setZoom(Math.max(0.2, Math.min(2, Math.round((scale + dir * 0.1) * 10) / 10)));

  const propose = async (kind: ProposalKind, ids?: string[]) => {
    if (!doc || !frame) return;
    const proposal = await FixtureProposalProvider.propose(kind, doc, ids?.length ? { frameId: frame.id, ids } : { frameId: frame.id });
    if (!proposal || (!proposal.changes.length && !proposal.skipped.length)) { say(kind === "contrast" ? "Nothing to change: all text here meets the contrast minimum." : "Nothing to change: everything is already on the grid."); return; }
    setDialog({ kind: "proposal", proposal, frameId: frame.id });
  };

  const onKey = (e: RKeyboardEvent<HTMLDivElement>) => {
    const tg = e.target as HTMLElement;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); e.shiftKey ? w.redo() : w.undo(); return; }
    if (mod && e.key.toLowerCase() === "y" && !typing) { e.preventDefault(); w.redo(); return; }
    if (typing) return;
    if (mod && e.key.toLowerCase() === "d" && valid.length) { e.preventDefault(); run({ type: "DUPLICATE", ids: valid }); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && valid.length) { e.preventDefault(); run({ type: "DELETE", ids: valid }); return; }
    if (e.key === "Escape" && (valid.length || tool === "comment" || dialog)) { e.stopPropagation(); if (dialog) setDialog(null); else if (tool === "comment") setTool("select"); else setSelection([]); }
  };

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as DesignDocument;
      if (parsed.schemaVersion !== SDD_SCHEMA) return say(`That file is not a design document this Workshop can read (${String(parsed.schemaVersion)}).`);
      if (parsed.projectId !== projectId) return say("That design belongs to a different project.");
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.frames) || parsed.territories?.length !== 3) return say("That design document is incomplete.");
      run({ type: "IMPORT", doc: { ...parsed, checkpoints: doc?.checkpoints ?? [] } });
      say("Imported as a new revision. Undo steps back.");
    } catch { say("That file could not be read as a design document."); }
  };

  if (w.loadError) return <div className="workshop-empty"><Empty title="The design could not be opened."><p>{w.loadError}</p><Button variant="ghost" className="ws-btn" onClick={() => void w.reload()}>Try again</Button></Empty></div>;
  if (!doc || !frame) return <div className="workshop-empty"><span className="pulse-dot" /> Opening the design…</div>;

  const terr = territoryOf(doc, terrId)!;
  const chosen = doc.selectedTerritoryId === terrId;
  const saveText = w.saveState === "saving" ? "Saving…" : w.saveState === "unsaved" ? "Unsaved changes" : w.saveState === "failed" ? "Could not save" : w.saveState === "conflict" ? "Out of date" : `Saved at r${doc.revision}`;
  const saveStatus = <span className={`ws-save is-${w.saveState}`} role="status">{saveText}{w.saveState === "failed" && <button type="button" onClick={() => void w.retrySave()}>Retry</button>}{w.saveState === "conflict" && <button type="button" onClick={() => void w.reload()}>Reload</button>}</span>;
  return (
    <div className="workshop" data-desk="workshop" onKeyDown={onKey}>
      <div className="window-bar"><div className="traffic-dots"><i /><i /><i /></div><span>&gt; DevPlaybook Design Workshop // {projectName} // r{doc.revision}</span><span className="window-more">{doc.status === "DRAFT" ? "Draft" : "In review"}</span></div>

      <div className="ws-toolbar" role="toolbar" aria-label="Workshop tools" data-more={more || undefined}>
        {/* On a phone (P6.21) the project and the save state stay at the top and the tools move to the bottom, by the thumb; on a
            wide screen both wrappers are transparent to layout, so the toolbar is one row as before. */}
        <div className="ws-tb-top">
          {picker}
          {phone && saveStatus}
        </div>
        <div className="ws-tb-tools">
          <div className="ws-group"><button type="button" className="ws-ibtn" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!w.canUndo} onClick={w.undo}><Undo2 size={15} /></button><button type="button" className="ws-ibtn" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!w.canRedo} onClick={w.redo}><Redo2 size={15} /></button></div>
          <div className="ws-group"><button type="button" className="ws-ibtn" aria-label="Select tool" title="Select" aria-pressed={tool === "select"} onClick={() => setTool("select")}><MousePointer2 size={15} /></button><button type="button" className="ws-ibtn" aria-label="Note tool" title="Add a note on the canvas" aria-pressed={tool === "comment"} onClick={() => { setTool("comment"); setRightTab("notes"); }}><MessageSquarePlus size={15} /></button></div>
          <div className="ws-group"><button type="button" className="ws-ibtn" aria-label="Zoom out" onClick={() => stepZoom(-1)}><ZoomOut size={15} /></button><button type="button" className="ws-zoom" onClick={() => setZoom("fit")} aria-label="Fit to screen" title="Fit to screen">{Math.round(scale * 100)}%</button><button type="button" className="ws-ibtn" aria-label="Zoom in" onClick={() => stepZoom(1)}><ZoomIn size={15} /></button></div>
          <div className="ws-group ws-extra"><button type="button" className="ws-ibtn" aria-label="Snap to guides" title="Snap to guides and the grid" aria-pressed={snap} onClick={() => setSnap(!snap)}><Magnet size={15} /></button><button type="button" className="ws-ibtn" aria-label="Show grid" title="Show the grid" aria-pressed={grid} onClick={() => setGrid(!grid)}><Grid3x3 size={15} /></button></div>
          <div className="ws-group ws-extra"><Button variant="ghost" className="ws-btn" onClick={() => download(`${slug(projectName)}-design-r${doc.revision}.json`, "application/json", documentJson(doc))}><Download size={14} /> Data</Button><Button variant="ghost" className="ws-btn" onClick={() => download(`${slug(projectName)}-${slug(frame.name)}-r${doc.revision}.svg`, "image/svg+xml", frameToSvg(doc, frame.id))}><Download size={14} /> Frame (SVG)</Button><Button variant="ghost" className="ws-btn" onClick={() => fileRef.current?.click()}><Upload size={14} /> Import</Button><input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="Import a design document" onChange={onImport} /></div>
          <button type="button" className="ws-ibtn ws-more" aria-label="More tools" aria-expanded={more} onClick={() => setMore((m) => !m)}><MoreHorizontal size={15} /></button>
          {!phone && saveStatus}
        </div>
      </div>
      {w.created && !doc.selectedTerritoryId && !bannerGone && <p className="ws-banner">Started from the territory exploration: three directions to choose between. Pick one to adjust, or compare them first.<button type="button" className="ws-banner-close" aria-label="Dismiss" onClick={() => setBannerGone(true)}><X size={14} /></button></p>}
      {w.where === "device" && <p className="ws-banner quiet">Kept on this device only. The agency&apos;s design service is not connected yet, so export the design to share it.</p>}
      {w.saveNote && <p className="ws-banner warn">{w.saveNote}</p>}

      <div className="ws-main" data-pane={phone ? pane : undefined} data-sheet={phone && sheet ? "" : undefined}>
        <LeftPanel doc={doc} tab={leftTab} setTab={setLeftTab} territoryId={terrId} setTerritory={(id) => { setActiveTerr(id); setActiveFrame(null); setSelection([]); if (phone) setPane("canvas"); }} frameId={frame.id} setFrame={setActiveFrame} selection={valid} setSelection={setSelection} run={run} compare={compare} setCompare={setCompare} choose={(t) => setDialog({ kind: "choose", territory: t })} />

        <section className="ws-center" aria-label="Canvas">
          <div className="ws-context">
            <b>{terr.name}</b><span className={`ws-chip${chosen ? " good" : ""}`}>{chosen ? "Chosen direction" : doc.selectedTerritoryId ? "Set aside" : "Not chosen yet"}</span>
            {compare ? <div className="ws-seg" role="group" aria-label="Compare on"><button type="button" aria-pressed={compareView === "desktop"} onClick={() => setCompareView("desktop")}>Desktop</button><button type="button" aria-pressed={compareView === "mobile"} onClick={() => setCompareView("mobile")}>Mobile</button></div>
              : <div className="ws-seg" role="group" aria-label="Frame">{frames.map((f) => <button key={f.id} type="button" aria-pressed={f.id === frame.id} onClick={() => { setActiveFrame(f.id); setSelection([]); }}>{f.name}</button>)}</div>}
          </div>
          {compare ? (
            <div className="ws-compare" ref={stageRef}>
              {doc.territories.map((t) => {
                const f = doc.frames.find((x) => x.territoryId === t.id && x.viewport === compareView) ?? doc.frames.find((x) => x.territoryId === t.id);
                return (
                  <article key={t.id} className={`ws-cmp${t.status === "SELECTED" ? " is-chosen" : ""}`}>
                    <header><b>{t.name}</b><span className="ws-chip">{t.posture.toLowerCase()}</span></header>
                    {f && <div className="ws-cmp-frame"><Artboard doc={doc} frameId={f.id} scale={compareView === "desktop" ? cmpW / f.w : Math.min(cmpW / f.w, 340 / f.h)} readOnly /></div>}
                    <p><b>Thesis.</b> {t.thesis}</p><p><b>Technique.</b> {t.technique}</p>
                    <div className="ws-cols"><div><h4>Strengths</h4><ul>{t.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div><div><h4>Risks</h4><ul>{t.risks.map((s) => <li key={s}>{s}</li>)}</ul></div></div>
                    <div className="ws-actions"><Button variant="ghost" className="ws-btn" onClick={() => { setActiveTerr(t.id); setActiveFrame(null); setCompare(false); }}>Edit this</Button>{t.status !== "SELECTED" && <Button className="ws-btn primary" onClick={() => setDialog({ kind: "choose", territory: t })}>Choose this direction</Button>}</div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={`ws-stage${tool === "comment" ? " is-commenting" : ""}`} ref={stageRef}>
              <Artboard doc={doc} frameId={frame.id} scale={scale} selection={valid} onSelect={setSelection} onOp={(op, o) => w.commit(op, o)} tool={tool} snap={snap} grid={grid} onRefuse={say} activePin={activePin} onPinClick={(id) => { setActivePin(id); setRightTab("notes"); }}
                onPin={(x, y, nodeId) => { const id = `note-${Date.now().toString(36)}`; run({ type: "ANNOTATE", note: { id, frameId: frame.id, nodeId, x, y, text: "", by: actor, at: new Date().toISOString(), resolved: false } }); setActivePin(id); setTool("select"); setRightTab("notes"); }} />
            </div>
          )}
        </section>

        {phone && sheet && <button type="button" className="ws-sheet-close" onClick={() => setSheet(false)}>Done</button>}
        <Inspector doc={doc} territoryId={terrId} frameId={frame.id} selection={valid} setSelection={setSelection} run={run} tab={rightTab} setTab={setRightTab} propose={(k, ids) => void propose(k, ids)} tool={tool} setTool={setTool} activePin={activePin} setActivePin={setActivePin} checkpoint={(n) => { w.checkpoint(n); say("Checkpoint saved."); }} restore={(cp) => setDialog({ kind: "restore", checkpoint: cp })} actor={actor} />
      </div>

      {phone && <div className="ws-panes" role="tablist" aria-label="Workshop panes">
        {(["directions", "canvas"] as const).map((p) => <button key={p} type="button" role="tab" aria-selected={pane === p} onClick={() => { setPane(p); setSheet(false); }}>{p === "directions" ? "Directions" : "Canvas"}</button>)}
        {pane === "canvas" && <button type="button" className="ws-edit-open" aria-expanded={sheet} onClick={() => setSheet(true)}>{valid.length ? `Edit (${valid.length})` : "Edit"}</button>}
      </div>}
      {toast && <p className="ws-toast" role="status">{toast}</p>}

      {dialog && (
        <div className="ws-dialog-wrap" onClick={() => setDialog(null)}>
          <div className="ws-dialog" role="dialog" aria-modal="true" aria-label={dialog.kind === "choose" ? "Choose a direction" : dialog.kind === "restore" ? "Restore a checkpoint" : "Review a proposal"} onClick={(e) => e.stopPropagation()}>
            {dialog.kind === "choose" && <ChooseDialog t={dialog.territory} onCancel={() => setDialog(null)} onConfirm={(why) => { run({ type: "SELECT_TERRITORY", id: dialog.territory.id, rationale: why }); setActiveTerr(dialog.territory.id); setActiveFrame(null); setCompare(false); setDialog(null); }} />}
            {dialog.kind === "restore" && (<><h3>Restore “{dialog.checkpoint.name}”?</h3><p className="ws-note">The design returns to how it was at r{dialog.checkpoint.revision}. This becomes a new revision, so nothing is lost and undo still works. Approvals touched by the change are reopened.</p><div className="ws-actions"><Button variant="ghost" className="ws-btn" onClick={() => setDialog(null)}>Cancel</Button><Button className="ws-btn primary" onClick={() => { run({ type: "RESTORE", snapshot: dialog.checkpoint.snapshot, name: dialog.checkpoint.name }); setSelection([]); setDialog(null); }}>Restore</Button></div></>)}
            {dialog.kind === "proposal" && <ProposalDialog doc={doc} d={dialog} onClose={() => setDialog(null)} onDecide={(accepted) => { const p = dialog.proposal; run({ type: "PROPOSAL", label: p.label, accepted, patches: p.changes.map((c) => ({ id: c.id, patch: c.patch })), rationale: p.rationale }); setDialog(null); }} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ChooseDialog({ t, onCancel, onConfirm }: { t: Territory; onCancel: () => void; onConfirm: (why: string) => void }) {
  const [why, setWhy] = useState("");
  return (
    <>
      <h3>Choose {t.name}?</h3>
      <p className="ws-note">{t.thesis}</p>
      <label className="wf"><span className="wf-label">Why this direction</span><textarea rows={3} autoFocus value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Recorded in the decision log so the reason is never lost" /></label>
      <p className="ws-hint">The other directions are set aside, not deleted. You can still open them and choose again.</p>
      <div className="ws-actions"><Button variant="ghost" className="ws-btn" onClick={onCancel}>Cancel</Button><Button className="ws-btn primary" onClick={() => onConfirm(why.trim())}>Choose this direction</Button></div>
    </>
  );
}

function ProposalDialog({ doc, d, onClose, onDecide }: { doc: DesignDocument; d: { proposal: Proposal; frameId: string }; onClose: () => void; onDecide: (accepted: boolean) => void }) {
  const p = d.proposal;
  return (
    <>
      <h3>{p.label}</h3>
      <p className="ws-note">{p.description} Review it, then accept or set it aside. Nothing has changed yet.</p>
      <div className="ws-ba">
        <figure><figcaption>Before</figcaption><Artboard doc={doc} frameId={d.frameId} scale={0.22} readOnly /></figure>
        <figure><figcaption>After</figcaption><Artboard doc={p.after} frameId={d.frameId} scale={0.22} readOnly /></figure>
      </div>
      {p.changes.length > 0 ? <ul className="ws-changes">{p.changes.map((c) => <li key={c.id}><b>{c.name}</b><small>{c.detail}</small></li>)}</ul> : <p className="ws-warn">No change can be made automatically.</p>}
      {p.skipped.length > 0 && <p className="ws-warn">Left alone because they are locked: {p.skipped.map((s) => s.name).join(", ")}.</p>}
      <div className="ws-actions"><Button variant="ghost" className="ws-btn" onClick={onClose}>Close</Button><Button variant="ghost" className="ws-btn" onClick={() => onDecide(false)}>Set aside</Button><Button className="ws-btn primary" disabled={!p.changes.length} onClick={() => onDecide(true)}>Accept {p.changes.length} change{p.changes.length === 1 ? "" : "s"}</Button></div>
    </>
  );
}
