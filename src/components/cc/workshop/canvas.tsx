"use client";

import { Lock } from "lucide-react";
import { useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { drawn, feedbackOn, type Op } from "@/lib/design/edit";
import { FONT_STACK, paintHex, radiusPx, slotOf, tokensOf, typeStyleOf, type SddBox, type SddDocument, type SddNode, type SddTokens } from "@/lib/design/v4";

/**
 * Draws one frame of v4's design document from each node's box, style and text (ADR-0051). The drawing is only a view: every change
 * goes back through `onOp` as an operation on the document. The words on it are the slots Content fills, never copy of the canvas's
 * own. The same component draws the small, read-only previews used to compare directions.
 */
const isImage = (n: SddNode) => n.type === "image" || n.type === "media" || n.assetRef !== null;

function nodeStyle(n: SddNode, box: SddBox, t: SddTokens): CSSProperties {
  const s = n.style;
  const base: CSSProperties = {
    position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, opacity: s.opacity, boxSizing: "border-box", overflow: "hidden",
    background: paintHex(s.fill, t), borderRadius: radiusPx(s.radius, t, box), border: s.stroke ? `1px solid ${paintHex(s.stroke, t)}` : undefined,
  };
  const type = n.text ? typeStyleOf(t, n.text.style) : null;
  if (!n.text || !type) return base;
  return {
    ...base, fontFamily: FONT_STACK[type.family], fontSize: n.text.size ?? type.size, fontWeight: type.weight, letterSpacing: `${type.tracking}em`, lineHeight: type.lineHeight,
    color: paintHex(n.text.colour, t, t.colour.text), textAlign: n.text.align, whiteSpace: "pre-wrap",
    ...(n.type === "control" ? { display: "flex", alignItems: "center", justifyContent: n.text.align === "left" ? "flex-start" : n.text.align === "right" ? "flex-end" : "center", padding: "0 12px" } : {}),
  };
}

function NodeBody({ n, t }: { n: SddNode; t: SddTokens }) {
  if (isImage(n)) {
    return (
      <div className="ws-placeholder" style={{ background: `repeating-linear-gradient(135deg, transparent 0 14px, ${t.colour.text}22 14px 15px)`, color: t.colour.text, fontFamily: FONT_STACK.sans }}>
        <span>IMAGE<br />{n.role}</span>
      </div>
    );
  }
  const slot = n.text ? slotOf(n) : null;
  return slot ? <span className="ws-slot-words" title="A slot for the copy Content writes">{slot.purpose || slot.key}</span> : null;
}

type Rect = { x: number; y: number; w: number; h: number };
type Drag = { kind: "move"; ids: string[]; carried: Set<string>; dx: number; dy: number; guides: { x: number | null; y: number | null } } | { kind: "resize"; id: string; rect: Rect; next: Rect };
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
const HANDLE_POS: Record<string, CSSProperties> = { nw: { left: -5, top: -5, cursor: "nwse-resize" }, n: { left: "50%", top: -5, marginLeft: -5, cursor: "ns-resize" }, ne: { right: -5, top: -5, cursor: "nesw-resize" }, e: { right: -5, top: "50%", marginTop: -5, cursor: "ew-resize" }, se: { right: -5, bottom: -5, cursor: "nwse-resize" }, s: { left: "50%", bottom: -5, marginLeft: -5, cursor: "ns-resize" }, sw: { left: -5, bottom: -5, cursor: "nesw-resize" }, w: { left: -5, top: "50%", marginTop: -5, cursor: "ew-resize" } };

export function Artboard({ doc, frameId, scale, selection, onSelect, onOp, tool, snap, grid, readOnly, onPin, activePin, onPinClick, onRefuse }: {
  doc: SddDocument; frameId: string; scale: number; selection?: string[] | undefined; onSelect?: ((ids: string[]) => void) | undefined; onOp?: ((op: Op, opts?: { coalesce?: string }) => string | null) | undefined;
  tool?: "select" | "comment" | undefined; snap?: boolean | undefined; grid?: boolean | undefined; readOnly?: boolean | undefined; onPin?: ((nodeId: string | null) => void) | undefined; activePin?: string | null | undefined; onPinClick?: ((id: string) => void) | undefined; onRefuse?: ((m: string) => void) | undefined;
}) {
  const frame = doc.frames.find((f) => f.id === frameId);
  const t = tokensOf(doc, frame);
  const nodes = frame ? drawn(doc, frame) : [];
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const sel = selection ?? [];
  if (!frame || !t || frame.width == null || frame.height == null) return null;
  const fw = frame.width, fh = frame.height;
  // The grid and snapping follow the smallest space token, the design's own step.
  const base = Math.max(1, Math.min(...Object.values(t.space).filter((v): v is number => typeof v === "number" && v > 0), 8));
  // Selecting is interactive in comment mode too, for a client leaving feedback on an element.
  const interactive = !readOnly || tool === "comment";

  const setD = (d: Drag | null) => { dragRef.current = d; setDrag(d); };
  const offset = (n: SddNode) => (drag?.kind === "move" && drag.carried.has(n.id) ? { dx: drag.dx, dy: drag.dy } : { dx: 0, dy: 0 });
  const rectOf = (n: SddNode): Rect => (drag?.kind === "resize" && drag.id === n.id ? drag.next : n.geometry.box!);
  const inside = (id: string): string[] => { const n = doc.nodes.find((x) => x.id === id); return n ? [id, ...n.children.flatMap(inside)] : []; };

  const startMove = (e: RPointerEvent, n: SddNode) => {
    if (tool === "comment") { e.stopPropagation(); onPin?.(n.id); return; }
    if (readOnly) return;
    e.stopPropagation();
    const ids = e.shiftKey ? (sel.includes(n.id) ? sel.filter((i) => i !== n.id) : [...sel, n.id]) : sel.includes(n.id) ? sel : [n.id];
    onSelect?.(ids);
    if (n.locked || e.shiftKey || !ids.includes(n.id)) return;
    const moving = nodes.filter((x) => ids.includes(x.id));
    if (moving.some((x) => x.locked)) { onRefuse?.("A locked element is selected. Unlock it to move it."); return; }
    const carried = new Set(ids.flatMap(inside));
    const others = nodes.filter((x) => !carried.has(x.id) && !x.hidden);
    const boxes = moving.map((x) => x.geometry.box!);
    const box = { l: Math.min(...boxes.map((b) => b.x)), t: Math.min(...boxes.map((b) => b.y)), r: Math.max(...boxes.map((b) => b.x + b.w)), b: Math.max(...boxes.map((b) => b.y + b.h)) };
    const xs = [0, fw / 2, fw, ...others.flatMap((x) => { const b = x.geometry.box!; return [b.x, b.x + b.w / 2, b.x + b.w]; })];
    const ys = [0, ...others.flatMap((x) => { const b = x.geometry.box!; return [b.y, b.y + b.h / 2, b.y + b.h]; })];
    const sx = e.clientX, sy = e.clientY;
    const near = (vals: number[], cands: number[], tol: number) => { let best: { d: number; at: number } | null = null; for (const v of vals) for (const c of cands) { const d = c - v; if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: c }; } return best; };
    const mv = (ev: PointerEvent) => {
      let dx = (ev.clientX - sx) / scale, dy = (ev.clientY - sy) / scale;
      let gx: number | null = null, gy: number | null = null;
      if (snap) {
        const bx = near([box.l + dx, (box.l + box.r) / 2 + dx, box.r + dx], xs, 6 / scale);
        const by = near([box.t + dy, (box.t + box.b) / 2 + dy, box.b + dy], ys, 6 / scale);
        if (bx) { dx += bx.d; gx = bx.at; }
        if (by) { dy += by.d; gy = by.at; }
      }
      setD({ kind: "move", ids, carried, dx, dy, guides: { x: gx, y: gy } });
    };
    const up = () => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      const d = dragRef.current;
      setD(null);
      if (d?.kind === "move" && (Math.abs(d.dx) >= 1 || Math.abs(d.dy) >= 1)) { const m = onOp?.({ type: "MOVE", ids: d.ids, dx: Math.round(d.dx), dy: Math.round(d.dy) }); if (m) onRefuse?.(m); }
    };
    const begin = () => { setD({ kind: "move", ids, carried, dx: 0, dy: 0, guides: { x: null, y: null } }); window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); };
    if (e.pointerType !== "touch") { begin(); return; }
    // A finger moves an element only after a short press (P6.21 P6), so scrolling the canvas never drags what it starts on.
    const hold = window.setTimeout(() => { stop(); begin(); }, 300);
    const early = (ev: PointerEvent) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) stop(); };
    const stop = () => { window.clearTimeout(hold); window.removeEventListener("pointermove", early); window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
    window.addEventListener("pointermove", early); window.addEventListener("pointerup", stop); window.addEventListener("pointercancel", stop);
  };

  const startResize = (e: RPointerEvent, n: SddNode, handle: string) => {
    e.stopPropagation(); e.preventDefault();
    const rect = { ...n.geometry.box! };
    const sx = e.clientX, sy = e.clientY;
    setD({ kind: "resize", id: n.id, rect, next: rect });
    const mv = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / scale, dy = (ev.clientY - sy) / scale;
      let { x, y, w, h } = rect;
      if (handle.includes("e")) w = rect.w + dx;
      if (handle.includes("s")) h = rect.h + dy;
      if (handle.includes("w")) { x = rect.x + dx; w = rect.w - dx; }
      if (handle.includes("n")) { y = rect.y + dy; h = rect.h - dy; }
      if (snap) { x = Math.round(x / base) * base; y = Math.round(y / base) * base; w = Math.max(base, Math.round(w / base) * base); h = Math.max(base, Math.round(h / base) * base); }
      if (w < 8) { if (handle.includes("w")) x -= 8 - w; w = 8; }
      if (h < 8) { if (handle.includes("n")) y -= 8 - h; h = 8; }
      setD({ kind: "resize", id: n.id, rect, next: { x, y, w, h } });
    };
    const up = () => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      const d = dragRef.current; setD(null);
      if (d?.kind === "resize" && (d.next.x !== d.rect.x || d.next.y !== d.rect.y || d.next.w !== d.rect.w || d.next.h !== d.rect.h)) { const m = onOp?.({ type: "BOX", id: d.id, box: d.next }); if (m) onRefuse?.(m); }
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };

  const onBackdrop = () => {
    if (tool === "comment") { onPin?.(null); return; }
    if (!readOnly) onSelect?.([]);
  };

  const onKey = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (readOnly || !sel.length) return;
    const step = e.shiftKey ? base : 1;
    const d = e.key === "ArrowLeft" ? [-step, 0] : e.key === "ArrowRight" ? [step, 0] : e.key === "ArrowUp" ? [0, -step] : e.key === "ArrowDown" ? [0, step] : null;
    if (!d) return;
    e.preventDefault();
    const m = onOp?.({ type: "MOVE", ids: sel, dx: d[0]!, dy: d[1]! }, { coalesce: `nudge:${sel.join(",")}` });
    if (m) onRefuse?.(m);
  };

  const selected = sel.length === 1 ? nodes.find((n) => n.id === sel[0]) : undefined;
  const handleNode = !readOnly && tool !== "comment" && selected && !selected.locked && !selected.hidden ? selected : undefined;
  const handleRect = handleNode ? rectOf(handleNode) : null;
  const guides = drag?.kind === "move" ? drag.guides : { x: null, y: null };
  // Feedback on an element is pinned to its corner, numbered as the feedback list numbers it.
  const pins = activePin !== undefined || onPinClick ? feedbackOn(doc, frame).map((a, i) => ({ a, i })).filter(({ a }) => a.target.kind === "NODE") : [];
  return (
    <div className="ws-artboard-wrap" style={{ width: fw * scale, height: fh * scale }}>
      <div className={`ws-artboard${readOnly ? " is-readonly" : ""}${tool === "comment" ? " is-commenting" : ""}`} style={{ width: fw, height: fh, transform: `scale(${scale})`, background: t.colour.surface }} onPointerDown={interactive ? onBackdrop : undefined} onKeyDown={onKey} tabIndex={readOnly ? -1 : 0} role="group" aria-label={`${frame.viewport ?? "Frame"}, ${nodes.length} elements.${readOnly ? "" : " Arrow keys move the selected element."}`}>
        {grid && !readOnly && <div className="ws-grid" style={{ backgroundSize: `${base * 4}px ${base * 4}px` }} aria-hidden="true" />}
        {nodes.map((n) => {
          if (n.hidden) return null;
          const o = offset(n); const r = rectOf(n);
          const style = { ...nodeStyle(n, r, t), left: r.x + o.dx, top: r.y + o.dy };
          const isSel = sel.includes(n.id);
          return (
            <div key={n.id} className={`ws-node${isSel ? " is-selected" : ""}${n.locked ? " is-locked" : ""}`} style={style} data-node={n.id}
              onPointerDown={interactive ? (e) => startMove(e, n) : undefined}
              role={interactive ? "button" : undefined} tabIndex={!interactive || !isSel ? -1 : 0} aria-pressed={interactive ? isSel : undefined}
              aria-label={interactive ? `${n.role}, ${n.type}${n.locked ? ", locked" : ""}` : undefined}
              onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (tool === "comment") onPin?.(n.id); else onSelect?.(e.shiftKey ? (isSel ? sel.filter((i) => i !== n.id) : [...sel, n.id]) : [n.id]); } } : undefined}>
              <NodeBody n={n} t={t} />
            </div>
          );
        })}
        {!readOnly && sel.map((id) => {
          const n = nodes.find((x) => x.id === id); if (!n || n.hidden) return null;
          const o = offset(n); const r = rectOf(n);
          return <div key={`o-${id}`} className={`ws-outline${n.locked ? " is-locked" : ""}`} style={{ left: r.x + o.dx, top: r.y + o.dy, width: r.w, height: r.h }} aria-hidden="true">{n.locked && <Lock size={12 / Math.max(scale, 0.5)} />}</div>;
        })}
        {handleNode && handleRect && <div className="ws-handles" style={{ left: handleRect.x, top: handleRect.y, width: handleRect.w, height: handleRect.h }}>{HANDLES.map((h) => <span key={h} className="ws-handle" style={{ ...HANDLE_POS[h], width: 10 / Math.max(scale, 0.4), height: 10 / Math.max(scale, 0.4) }} onPointerDown={(e) => startResize(e, handleNode, h)} aria-hidden="true" />)}</div>}
        {guides.x !== null && <div className="ws-guide ws-guide-v" style={{ left: guides.x }} aria-hidden="true" />}
        {guides.y !== null && <div className="ws-guide ws-guide-h" style={{ top: guides.y }} aria-hidden="true" />}
        {pins.map(({ a, i }) => {
          const n = nodes.find((x) => x.id === a.target.id);
          if (!n || n.hidden) return null;
          const b = rectOf(n);
          return <button key={a.id} type="button" className={`ws-pin${a.status !== "OPEN" ? " is-resolved" : ""}${activePin === a.id ? " is-active" : ""}`} style={{ left: Math.min(b.x + b.w, fw) - 12, top: Math.max(0, b.y - 12), transform: `scale(${1 / Math.max(scale, 0.5)})` }} onPointerDown={(e) => e.stopPropagation()} onClick={() => onPinClick?.(a.id)} aria-label={`Feedback ${i + 1}: ${a.text}${a.status !== "OPEN" ? ` (${a.status.toLowerCase()})` : ""}`}>{i + 1}</button>;
        })}
      </div>
    </div>
  );
}
