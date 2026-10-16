"use client";

import { Lock } from "lucide-react";
import { useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import type { Op } from "@/lib/design/ops";
import { FONT_STACK, frameTokens, nodesOf, paintHex, radiusPx, type DesignDocument, type SNode, type Tokens } from "@/lib/design/sdd";

/**
 * Draws one frame of the design document. The drawing is only a view: every change goes back through `onOp` as an operation on
 * the document. The same component draws the small, read-only previews used to compare territories.
 */
function nodeStyle(n: SNode, t: Tokens): CSSProperties {
  const base: CSSProperties = { position: "absolute", left: n.x, top: n.y, width: n.w, height: n.h, opacity: n.opacity ?? 1, boxSizing: "border-box", overflow: "hidden" };
  const radius = radiusPx(n.radius, t, n.w, n.h);
  if (n.kind === "line") return { ...base, background: paintHex(n.fill, t, t.color.border) };
  const box: CSSProperties = { ...base, background: n.kind === "text" ? undefined : paintHex(n.fill, t, "transparent"), borderRadius: radius, border: n.stroke ? `1px solid ${paintHex(n.stroke, t)}` : undefined };
  if (!n.text) return box;
  const s = t.type[n.text.style];
  return { ...box, fontFamily: FONT_STACK[s.family], fontSize: n.text.size ?? s.size, fontWeight: s.weight, letterSpacing: `${s.tracking}px`, lineHeight: s.lineHeight, color: paintHex(n.text.color, t), textAlign: n.text.align, whiteSpace: "pre-wrap", ...(n.kind === "button" ? { display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" as const } : {}) };
}

function NodeBody({ n, t }: { n: SNode; t: Tokens }) {
  if (n.kind === "image") {
    return (
      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: `repeating-linear-gradient(135deg, transparent 0 14px, ${t.color.border} 14px 15px)`, color: t.color.textMuted, fontFamily: FONT_STACK.sans, fontSize: 12, textAlign: "center", padding: 12 }}>
        <span>PLACEHOLDER<br />{n.asset?.label}</span>
      </div>
    );
  }
  return n.text ? <>{n.text.content}</> : null;
}

type Drag = { kind: "move"; ids: string[]; sx: number; sy: number; dx: number; dy: number; guides: { x: number | null; y: number | null } } | { kind: "resize"; id: string; handle: string; sx: number; sy: number; rect: { x: number; y: number; w: number; h: number }; next: { x: number; y: number; w: number; h: number } };
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
const HANDLE_POS: Record<string, CSSProperties> = { nw: { left: -5, top: -5, cursor: "nwse-resize" }, n: { left: "50%", top: -5, marginLeft: -5, cursor: "ns-resize" }, ne: { right: -5, top: -5, cursor: "nesw-resize" }, e: { right: -5, top: "50%", marginTop: -5, cursor: "ew-resize" }, se: { right: -5, bottom: -5, cursor: "nwse-resize" }, s: { left: "50%", bottom: -5, marginLeft: -5, cursor: "ns-resize" }, sw: { left: -5, bottom: -5, cursor: "nesw-resize" }, w: { left: -5, top: "50%", marginTop: -5, cursor: "ew-resize" } };

export function Artboard({ doc, frameId, scale, selection, onSelect, onOp, tool, snap, grid, readOnly, onPin, activePin, onPinClick, onRefuse }: {
  doc: DesignDocument; frameId: string; scale: number; selection?: string[]; onSelect?: (ids: string[]) => void; onOp?: (op: Op, opts?: { coalesce?: string }) => string | null;
  tool?: "select" | "comment"; snap?: boolean; grid?: boolean; readOnly?: boolean; onPin?: (x: number, y: number, nodeId: string | null) => void; activePin?: string | null; onPinClick?: (id: string) => void; onRefuse?: (m: string) => void;
}) {
  const frame = doc.frames.find((f) => f.id === frameId);
  const t = frameTokens(doc, frameId);
  const nodes = nodesOf(doc, frameId);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const sel = selection ?? [];
  if (!frame || !t) return null;
  const base = Math.max(1, t.space.base);

  const setD = (d: Drag | null) => { dragRef.current = d; setDrag(d); };
  const offset = (n: SNode) => (drag?.kind === "move" && drag.ids.includes(n.id) ? { dx: drag.dx, dy: drag.dy } : { dx: 0, dy: 0 });
  const rectOf = (n: SNode) => (drag?.kind === "resize" && drag.id === n.id ? drag.next : { x: n.x, y: n.y, w: n.w, h: n.h });

  const startMove = (e: RPointerEvent, n: SNode) => {
    if (readOnly) return;
    if (tool === "comment") return;
    e.stopPropagation();
    const group = n.group ? nodes.filter((x) => x.group === n.group).map((x) => x.id) : [n.id];
    const ids = e.shiftKey ? (sel.includes(n.id) ? sel.filter((i) => !group.includes(i)) : [...sel, ...group]) : sel.includes(n.id) ? sel : group;
    onSelect?.(ids);
    if (n.locked || e.shiftKey || !ids.includes(n.id)) return;
    const moving = nodes.filter((x) => ids.includes(x.id));
    if (moving.some((x) => x.locked)) { onRefuse?.("A locked node is selected. Unlock it to move it."); return; }
    const others = nodes.filter((x) => !ids.includes(x.id) && !x.hidden);
    const box = { l: Math.min(...moving.map((x) => x.x)), t: Math.min(...moving.map((x) => x.y)), r: Math.max(...moving.map((x) => x.x + x.w)), b: Math.max(...moving.map((x) => x.y + x.h)) };
    const xs = [0, frame.w / 2, frame.w, ...others.flatMap((x) => [x.x, x.x + x.w / 2, x.x + x.w])];
    const ys = [0, frame.h / 2, frame.h, ...others.flatMap((x) => [x.y, x.y + x.h / 2, x.y + x.h])];
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
      setD({ kind: "move", ids, sx, sy, dx, dy, guides: { x: gx, y: gy } });
    };
    const up = () => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      const d = dragRef.current;
      setD(null);
      if (d?.kind === "move" && (Math.abs(d.dx) >= 1 || Math.abs(d.dy) >= 1)) { const m = onOp?.({ type: "MOVE", ids: d.ids, dx: d.dx, dy: d.dy }); if (m) onRefuse?.(m); }
    };
    const begin = () => { setD({ kind: "move", ids, sx, sy, dx: 0, dy: 0, guides: { x: null, y: null } }); window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); };
    if (e.pointerType !== "touch") { begin(); return; }
    // A finger moves a node only after a short press (P6.21 P6), so scrolling the canvas never drags what it starts on.
    const hold = window.setTimeout(() => { stop(); begin(); }, 300);
    const early = (ev: PointerEvent) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) stop(); };
    const stop = () => { window.clearTimeout(hold); window.removeEventListener("pointermove", early); window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
    window.addEventListener("pointermove", early); window.addEventListener("pointerup", stop); window.addEventListener("pointercancel", stop);
  };

  const startResize = (e: RPointerEvent, n: SNode, handle: string) => {
    e.stopPropagation(); e.preventDefault();
    const rect = { x: n.x, y: n.y, w: n.w, h: n.h };
    const sx = e.clientX, sy = e.clientY;
    setD({ kind: "resize", id: n.id, handle, sx, sy, rect, next: rect });
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
      setD({ kind: "resize", id: n.id, handle, sx, sy, rect, next: { x, y, w, h } });
    };
    const up = () => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      const d = dragRef.current; setD(null);
      if (d?.kind === "resize" && (d.next.x !== d.rect.x || d.next.y !== d.rect.y || d.next.w !== d.rect.w || d.next.h !== d.rect.h)) { const m = onOp?.({ type: "RECT", id: d.id, ...d.next }); if (m) onRefuse?.(m); }
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };

  const onBackdrop = (e: RPointerEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - r.left) / scale), y = Math.round((e.clientY - r.top) / scale);
    if (tool === "comment") { onPin?.(x, y, null); return; }
    onSelect?.([]);
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
  const handleNode = !readOnly && selected && !selected.locked && !selected.hidden ? selected : undefined;
  const handleRect = handleNode ? rectOf(handleNode) : null;
  const guides = drag?.kind === "move" ? drag.guides : { x: null, y: null };
  return (
    <div className="ws-artboard-wrap" style={{ width: frame.w * scale, height: frame.h * scale }}>
      <div className={`ws-artboard${readOnly ? " is-readonly" : ""}${tool === "comment" ? " is-commenting" : ""}`} style={{ width: frame.w, height: frame.h, transform: `scale(${scale})`, background: t.color.surface }} onPointerDown={onBackdrop} onKeyDown={onKey} tabIndex={readOnly ? -1 : 0} role="group" aria-label={`${frame.name}, ${nodes.length} elements. Arrow keys move the selected element.`}>
        {grid && !readOnly && <div className="ws-grid" style={{ backgroundSize: `${base * 4}px ${base * 4}px` }} aria-hidden="true" />}
        {nodes.map((n) => {
          if (n.hidden) return null;
          const o = offset(n); const r = rectOf(n);
          const style = { ...nodeStyle(n, t), left: r.x + o.dx, top: r.y + o.dy, width: r.w, height: r.h };
          const isSel = sel.includes(n.id);
          return (
            <div key={n.id} className={`ws-node${isSel ? " is-selected" : ""}${n.locked ? " is-locked" : ""}`} style={style} data-node={n.id}
              onPointerDown={readOnly ? undefined : (e) => startMove(e, n)}
              role={readOnly ? undefined : "button"} tabIndex={readOnly || !isSel ? -1 : 0} aria-pressed={readOnly ? undefined : isSel}
              aria-label={readOnly ? undefined : `${n.name}, ${n.role}${n.locked ? ", locked" : ""}`}
              onKeyDown={readOnly ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(e.shiftKey ? (isSel ? sel.filter((i) => i !== n.id) : [...sel, n.id]) : [n.id]); } }}>
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
        {!readOnly && doc.annotations.filter((a) => a.frameId === frameId).map((a, i) => (
          <button key={a.id} type="button" className={`ws-pin${a.resolved ? " is-resolved" : ""}${activePin === a.id ? " is-active" : ""}`} style={{ left: a.x, top: a.y, transform: `scale(${1 / Math.max(scale, 0.5)})` }} onPointerDown={(e) => e.stopPropagation()} onClick={() => onPinClick?.(a.id)} aria-label={`Note ${i + 1}: ${a.text || "empty"}${a.resolved ? " (resolved)" : ""}`}>{i + 1}</button>
        ))}
      </div>
    </div>
  );
}
