"use client";

import { Eye, EyeOff, Image as ImageIcon, Lock, MousePointer2, Square, Type } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import type { Op } from "@/lib/design/edit";
import { POSTURE_WORDS, nodesOf, type SddDocument, type SddNode } from "@/lib/design/v4";
import { Artboard } from "./canvas";
import { tokenWords } from "./fields";

export type LeftTab = "directions" | "layers";
const iconOf = (n: SddNode) => (n.text ? Type : n.type === "control" ? MousePointer2 : n.type === "image" || n.type === "media" || n.assetRef ? ImageIcon : Square);
export const viewportWords = (v: string | null) => (v === "phone" ? "Phone" : v === "desktop" ? "Desktop" : v ?? "Frame");

export function LeftPanel({ doc, tab, setTab, territoryId, setTerritory, frameId, setFrame, selection, setSelection, run, editable }: {
  doc: SddDocument; tab: LeftTab; setTab: (t: LeftTab) => void; territoryId: string | null; setTerritory: (id: string) => void; frameId: string; setFrame: (id: string) => void;
  selection: string[]; setSelection: (ids: string[]) => void; run: (op: Op) => void; editable: boolean;
}) {
  const frames = doc.frames.filter((f) => f.territoryId === territoryId);
  const frame = doc.frames.find((f) => f.id === frameId);
  const nodes = frame ? nodesOf(doc, frame) : [];
  const depth = (n: SddNode): number => { let d = 0; for (let p = n.parentId; p; p = doc.nodes.find((x) => x.id === p)?.parentId ?? null) d++; return d; };
  return (
    <div className="ws-left">
      <div className="ws-tabs" role="tablist" aria-label="Directions and layers">
        <button role="tab" type="button" aria-selected={tab === "directions"} className={tab === "directions" ? "active" : ""} onClick={() => setTab("directions")}>Directions</button>
        <button role="tab" type="button" aria-selected={tab === "layers"} className={tab === "layers" ? "active" : ""} onClick={() => setTab("layers")}>Layers</button>
      </div>
      <div className="ws-tabpanel" role="tabpanel">
        {tab === "directions" && doc.territories.map((t) => {
          const key = doc.frames.find((f) => f.territoryId === t.id && f.viewport === "desktop") ?? doc.frames.find((f) => f.territoryId === t.id);
          const active = t.id === territoryId;
          return (
            <article key={t.id} className={`ws-terr${active ? " is-active" : ""}${t.status === "SELECTED" ? " is-chosen" : ""}${t.status === "SET_ASIDE" ? " is-aside" : ""}`}>
              {key && <div className="ws-terr-thumb"><Thumb doc={doc} frameId={key.id} /></div>}
              <div className="ws-terr-body">
                <div className="ws-terr-head"><b>{t.concept}</b><span className={`ws-chip${t.status === "SELECTED" ? " good" : ""}`}>{t.status === "SELECTED" ? "Chosen" : t.status === "SET_ASIDE" ? "Set aside" : t.posture ? POSTURE_WORDS[t.posture] : "Proposed"}</span></div>
                {t.thesis && <p>{t.thesis}</p>}
                <div className="ws-actions"><Button variant="ghost" className="ws-btn" aria-pressed={active} onClick={() => setTerritory(t.id)}>{active ? (editable ? "Editing" : "Showing") : editable ? "Edit this" : "Show this"}</Button></div>
              </div>
            </article>
          );
        })}
        {tab === "layers" && (
          <>
            <div className="ws-frames" role="group" aria-label="Frames">
              {frames.map((f) => <button key={f.id} type="button" className={f.id === frameId ? "active" : ""} aria-pressed={f.id === frameId} onClick={() => { setFrame(f.id); setSelection([]); }}><span>{viewportWords(f.viewport)}</span><small>{f.width}×{f.height}</small></button>)}
            </div>
            <ol className="ws-layers" aria-label="Layers, outermost first">
              {nodes.map((n) => {
                const Icon = iconOf(n);
                const sel = selection.includes(n.id);
                return (
                  <li key={n.id} className={`${sel ? "is-selected" : ""}${n.hidden ? " is-hidden" : ""}`} style={{ paddingLeft: Math.min(depth(n), 6) * 10 }}>
                    <button type="button" className="ws-layer" aria-pressed={sel} onClick={(e) => setSelection(e.shiftKey ? (sel ? selection.filter((i) => i !== n.id) : [...selection, n.id]) : [n.id])}><Icon size={13} aria-hidden="true" /><span>{tokenWords(n.role)}</span>{!n.geometry.box ? <em>not placed</em> : null}</button>
                    {editable && <>
                      <button type="button" className="ws-ibtn sm" aria-label={n.locked ? `Unlock ${n.role}` : `Lock ${n.role}`} aria-pressed={n.locked} onClick={() => run({ type: "LOCK", ids: [n.id], locked: !n.locked })}><Lock size={12} style={{ opacity: n.locked ? 1 : 0.35 }} /></button>
                      <button type="button" className="ws-ibtn sm" aria-label={n.hidden ? `Show ${n.role}` : `Hide ${n.role}`} aria-pressed={n.hidden} onClick={() => run({ type: "PATCH", ids: [n.id], patch: { hidden: !n.hidden }, label: n.hidden ? "Shown" : "Hidden" })}>{n.hidden ? <EyeOff size={12} /> : <Eye size={12} style={{ opacity: 0.55 }} />}</button>
                    </>}
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

/** A direction's key frame, small and read-only. Drawn again only when the document changes. */
const Thumb = memo(function Thumb({ doc, frameId }: { doc: SddDocument; frameId: string }) {
  const frame = doc.frames.find((f) => f.id === frameId);
  return frame?.width ? <Artboard doc={doc} frameId={frameId} scale={232 / frame.width} readOnly /> : null;
}, (a, b) => a.frameId === b.frameId && a.doc === b.doc);
