"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { THRESHOLD_MS, useReducedMotion } from "@/lib/motion";
import type { SceneOrigin } from "./scene";

/** How long a desk takes to open (desks.css `desk-open`), after which the room behind it is held still. */
const OPEN_MS = 340;

/**
 * A desk opens over the room it belongs to, not instead of it. The room stays mounted behind a dim scrim and the desk is a
 * panel with margins, so the room still shows in the corners. It is a real dialog: focus moves in and returns to the object that
 * was pressed, Tab stays inside (the room behind is inert), Escape and the scrim go back, and the page behind does not scroll.
 * Escape never discards typing: inside a field it only leaves the field.
 */
export function DeskOverlay({ label, backLabel, path, surface, origin, wide, onBack, children }: { label: string; backLabel: string; path: ReactNode; surface: string; origin?: SceneOrigin | undefined; /** A working tool that needs room (the Design Workshop), not a page to read. */ wide?: boolean | undefined; onBack: () => void; children: ReactNode }) {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const panel = panelRef.current;
    panel?.focus({ preventScroll: true });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      // Hand focus back to the object that opened this desk, if the room is still there.
      document.querySelector<HTMLElement>("[data-return-focus]")?.focus({ preventScroll: true });
    };
  }, []);

  // Once the desk has finished opening, the room behind it is held still (desks.css): covered, it should cost nothing to draw.
  useEffect(() => {
    const root = document.documentElement;
    const t = window.setTimeout(() => root.setAttribute("data-desk-open", ""), reduced ? 0 : OPEN_MS);
    return () => { window.clearTimeout(t); root.removeAttribute("data-desk-open"); };
  }, [reduced]);

  const back = () => {
    if (leaving) return;
    document.documentElement.removeAttribute("data-desk-open"); // the room moves again as the desk starts to close
    if (reduced) return onBack();
    setLeaving(true);
    window.setTimeout(onBack, 220);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      const t = e.target;
      if (t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) { t.blur(); return; }
      e.preventDefault();
      back();
      return;
    }
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const style = origin ? ({ "--dx": `${origin.x}%`, "--dy": `${origin.y}%`, "--leave-ms": `${THRESHOLD_MS - 80}ms` } as CSSProperties) : undefined;
  return (
    <div className="desk-overlay" data-leaving={leaving || undefined} style={style} onKeyDown={onKeyDown}>
      <div className="desk-scrim" aria-hidden="true" onClick={back} />
      <div ref={panelRef} className="desk-panel" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} data-surface={surface} data-wide={wide || undefined}>
        <div className="desk-bar workspace-heading">
          <Button variant="ghost" className="back-link" onClick={back}><ArrowLeft size={16} /> {backLabel}</Button>
          <span className="workspace-path">{path}</span>
          <span className="workspace-right"><span className="live-dot" /> LIVE LEDGER</span>
        </div>
        <div className="desk-scroll">{children}</div>
      </div>
    </div>
  );
}
