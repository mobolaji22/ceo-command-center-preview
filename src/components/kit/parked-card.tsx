"use client";

import { useId, type ReactNode } from "react";

/**
 * A card parked below the scene's edge (v4 ADR-0099 Decision 3): only its tab shows, with its name and v4's count in words. Pointing at
 * it previews the move (it lifts and settles); pressing the tab raises it. Its contents are inert while it is parked, so the keyboard
 * and assistive tech meet only the tab. Decide, Know and Board are this one component.
 */
export function ParkedCard({ name, line, pen, open, onToggle, children, className }: {
  name: string;
  /** The count in words, v4's number. */
  line: string;
  /** True when the line is something waiting on the owner's pen: the one place the signing colour appears. */
  pen?: boolean | undefined;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string | undefined;
}) {
  const id = useId();
  return (
    <section className={`parked ${open ? "is-open" : ""} ${className ?? ""}`} aria-labelledby={`${id}-name`}>
      <h2 className="parked-h">
        <button type="button" className="parked-tab" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
          <span id={`${id}-name`} className="parked-name">{name}</span>
          <span className={`parked-line ${pen ? "is-pen" : ""}`}>{line}</span>
        </button>
      </h2>
      <div id={`${id}-body`} className="parked-body" inert={!open}>{children}</div>
    </section>
  );
}
