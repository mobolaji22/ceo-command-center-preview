"use client";

import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react";

const CHOSEN = '[aria-selected="true"], [aria-pressed="true"], [aria-checked="true"], [aria-current]';

/**
 * A row of choices (tabs, chips, a segmented control) with one highlight that slides to whichever is chosen, so the eye is
 * carried from the old choice to the new one. The row's own buttons stay exactly as they are: the chosen one is found by its
 * ARIA state, measured, and the highlight is clipped to it. Clipping costs no layout and keeps the corners crisp at any width.
 * `line` is an underline (tabs); `pill` is a filled highlight behind the label (chips, segments).
 *
 * `active` is whatever identifies the choice; the highlight is measured again when it changes and when the row is resized.
 */
export function SlideGroup({ active, variant = "line", className, children, ...rest }: { active: string | number | null | undefined; variant?: "line" | "pill"; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    const place = () => {
      const chosen = row.querySelector<HTMLElement>(CHOSEN);
      if (!chosen) { row.style.setProperty("--slide-on", "0"); return; }
      const a = row.getBoundingClientRect();
      const b = chosen.getBoundingClientRect();
      row.style.setProperty("--slide-on", "1");
      row.style.setProperty("--slide-l", `${b.left - a.left}px`);
      row.style.setProperty("--slide-r", `${a.right - b.right}px`);
      row.style.setProperty("--slide-t", `${b.top - a.top}px`);
      row.style.setProperty("--slide-b", `${a.bottom - b.bottom}px`);
    };
    place();
    // The first placement is not a move: the highlight starts where the choice already is, and only later changes travel.
    const ready = requestAnimationFrame(() => row.setAttribute("data-ready", ""));
    const watch = new ResizeObserver(place);
    watch.observe(row);
    return () => { cancelAnimationFrame(ready); watch.disconnect(); };
  }, [active]);
  return (
    <div ref={ref} className={`slide-group slide-${variant}${className ? ` ${className}` : ""}`} {...rest}>
      <i aria-hidden="true" className="slide-mark" />
      {children}
    </div>
  );
}
