"use client";

import { useEffect, useRef } from "react";
import { useMedia, useReducedMotion } from "@/lib/motion";

/**
 * A soft pool of lamplight that trails a real pointer across dark surfaces. It lags a little behind the cursor so it reads as
 * light rather than as a second cursor, stops its frame loop when it catches up, and is switched off (not rendered) for touch,
 * for reduced motion, and by the stylesheet in day lighting and focus mode. It never takes pointer events.
 */
export function CursorLight() {
  const fine = useMedia("(hover: hover) and (pointer: fine)");
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const enabled = fine && !reduced;

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const target = { x: -999, y: -999 };
    const cur = { x: -999, y: -999 };
    let raf = 0;
    const R = 260;
    const step = () => {
      cur.x += (target.x - cur.x) * 0.14;
      cur.y += (target.y - cur.y) * 0.14;
      el.style.transform = `translate3d(${(cur.x - R).toFixed(1)}px, ${(cur.y - R).toFixed(1)}px, 0)`;
      raf = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.5 ? requestAnimationFrame(step) : 0;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (cur.x === -999) { cur.x = e.clientX; cur.y = e.clientY; }
      target.x = e.clientX;
      target.y = e.clientY;
      el.dataset["on"] = "";
      if (!raf) raf = requestAnimationFrame(step);
    };
    const out = (e: MouseEvent) => { if (!e.relatedTarget) delete el.dataset["on"]; };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("mouseout", out);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("mouseout", out);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <div ref={ref} className="cursor-light" aria-hidden="true" />;
}
