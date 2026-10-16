"use client";

import { Eye, EyeOff, Image as ImageIcon, Lock, Minus, MousePointer2, Square, Type } from "lucide-react";
import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { frameToSvg } from "@/lib/design/export";
import type { Op } from "@/lib/design/ops";
import type { DesignDocument, NodeKind, Territory } from "@/lib/design/sdd";

export type LeftTab = "directions" | "layers";
const KIND_ICON: Record<NodeKind, typeof Square> = { rect: Square, text: Type, button: MousePointer2, image: ImageIcon, line: Minus };
const POSTURE: Record<Territory["posture"], string> = { CONSERVATIVE: "Conservative", DISTINCTIVE: "Distinctive", EXPERIMENTAL: "Experimental" };

export function LeftPanel({ doc, tab, setTab, territoryId, setTerritory, frameId, setFrame, selection, setSelection, run, compare, setCompare, choose }: {
  doc: DesignDocument; tab: LeftTab; setTab: (t: LeftTab) => void; territoryId: string; setTerritory: (id: string) => void; frameId: string; setFrame: (id: string) => void;
  selection: string[]; setSelection: (ids: string[]) => void; run: (op: Op) => void; compare: boolean; setCompare: (v: boolean) => void; choose: (t: Territory) => void;
}) {
  const frames = doc.frames.filter((f) => f.territoryId === territoryId);
  const nodes = doc.nodes.filter((n) => n.frameId === frameId);
  return (
    <div className="ws-left">
      <div className="ws-tabs" role="tablist" aria-label="Directions and layers">
        <button role="tab" type="button" aria-selected={tab === "directions"} className={tab === "directions" ? "active" : ""} onClick={() => setTab("directions")}>Directions</button>
        <button role="tab" type="button" aria-selected={tab === "layers"} className={tab === "layers" ? "active" : ""} onClick={() => setTab("layers")}>Layers</button>
      </div>
      <div className="ws-tabpanel" role="tabpanel">
        {tab === "directions" && (
          <>
            <Button variant="ghost" className={`ws-btn wide${compare ? " primary" : ""}`} aria-pressed={compare} onClick={() => setCompare(!compare)}>{compare ? "Back to editing" : "Compare side by side"}</Button>
            {doc.territories.map((t) => {
              const key = doc.frames.find((f) => f.territoryId === t.id && f.viewport === "desktop") ?? doc.frames.find((f) => f.territoryId === t.id);
              const active = t.id === territoryId;
              return (
                <article key={t.id} className={`ws-terr${active ? " is-active" : ""}${t.status === "SELECTED" ? " is-chosen" : ""}${t.status === "SET_ASIDE" ? " is-aside" : ""}`}>
                  {key && <div className="ws-terr-thumb"><Thumb doc={doc} frameId={key.id} /></div>}
                  <div className="ws-terr-body">
                    <div className="ws-terr-head"><b>{t.name}</b><span className={`ws-chip${t.status === "SELECTED" ? " good" : ""}`}>{t.status === "SELECTED" ? "Chosen" : POSTURE[t.posture]}</span></div>
                    <p>{t.thesis}</p>
                    <div className="ws-actions">
                      <Button variant="ghost" className="ws-btn" aria-pressed={active} onClick={() => { setTerritory(t.id); setCompare(false); }}>{active ? "Editing" : "Edit this"}</Button>
                      {t.status !== "SELECTED" && <Button variant="ghost" className="ws-btn" onClick={() => choose(t)}>Choose</Button>}
                    </div>
                  </div>
                </article>
              );
            })}
          </>
        )}
        {tab === "layers" && (
          <>
            <div className="ws-frames" role="group" aria-label="Frames">
              {frames.map((f) => {
                const ap = [...doc.approvals].reverse().find((a) => a.frameIds.includes(f.id));
                return <button key={f.id} type="button" className={f.id === frameId ? "active" : ""} aria-pressed={f.id === frameId} onClick={() => { setFrame(f.id); setSelection([]); setCompare(false); }}><span>{f.name}</span><small>{f.w}×{f.h}{ap ? (ap.stale ? " · reopened" : " · approved") : ""}</small></button>;
              })}
            </div>
            <ol className="ws-layers" aria-label="Layers, top first">
              {[...nodes].reverse().map((n) => {
                const Icon = KIND_ICON[n.kind];
                const sel = selection.includes(n.id);
                return (
                  <li key={n.id} className={`${sel ? "is-selected" : ""}${n.hidden ? " is-hidden" : ""}`}>
                    <button type="button" className="ws-layer" aria-pressed={sel} onClick={(e) => setSelection(e.shiftKey ? (sel ? selection.filter((i) => i !== n.id) : [...selection, n.id]) : [n.id])}><Icon size={13} aria-hidden="true" /><span>{n.name}</span>{n.group ? <em>group</em> : null}</button>
                    <button type="button" className="ws-ibtn sm" aria-label={n.locked ? `Unlock ${n.name}` : `Lock ${n.name}`} aria-pressed={!!n.locked} onClick={() => run({ type: "LOCK", ids: [n.id], locked: !n.locked })}><Lock size={12} style={{ opacity: n.locked ? 1 : 0.35 }} /></button>
                    <button type="button" className="ws-ibtn sm" aria-label={n.hidden ? `Show ${n.name}` : `Hide ${n.name}`} aria-pressed={!!n.hidden} onClick={() => run({ type: "PATCH", ids: [n.id], patch: { hidden: !n.hidden }, label: n.hidden ? "Shown" : "Hidden" })}>{n.hidden ? <EyeOff size={12} /> : <Eye size={12} style={{ opacity: 0.55 }} />}</button>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A direction's preview as one picture, not a live copy of the editor (P6.21): three live artboards, each every element of its frame,
 * made the Directions tab slow to draw and scroll. Drawn again only when the document changes. An image runs nothing, whatever the
 * document holds.
 */
const Thumb = memo(function Thumb({ doc, frameId }: { doc: DesignDocument; frameId: string }) {
  const src = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(frameToSvg(doc, frameId))}`, [doc, frameId]);
  const frame = doc.frames.find((f) => f.id === frameId);
  // eslint-disable-next-line @next/next/no-img-element -- a picture generated in the browser from the document; next/image has nothing to optimise
  return <img className="ws-terr-img" src={src} alt="" width={frame?.w} height={frame?.h} decoding="async" loading="lazy" />;
}, (a, b) => a.frameId === b.frameId && a.doc.revision === b.doc.revision);
