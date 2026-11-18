"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tick } from "./tick";

type Phase = "idle" | "working" | "done" | "failed";
/** What an action answers with: nothing when it went through, or the reason it did not. */
export type ActionResult = void | { error?: string | null | undefined };

/** How long "done" stays on the button before it offers the action again. */
const HOLD_MS = 1600;

/**
 * A button that reports on what it started: it says it is working, then that it is done (a drawn tick and the past-tense word),
 * or that it failed and why. It never claims success ahead of the answer: "done" is shown only after `run` resolves without an
 * error, so an approval or a signature reads as made only once v4 has made it. Its faces are stacked in one cell, so the button is
 * as wide as its widest word and nothing beside it moves; it keeps focus while it works (it is marked busy rather than disabled), and says each outcome to assistive tech.
 *
 * While it reports, the caller's own `disabled` does not dim it (sending a message empties the box it was sent from, which would
 * otherwise grey out the very tick that says it was sent); it still cannot be pressed.
 *
 * `onDone` runs once the tick has been seen, which is where the caller moves on (refresh the list, close the panel).
 * `onFailed` hands the caller the reason, to show in the screen's own words beside the button.
 */
export function ActionButton({ run, children, doneLabel, workingLabel = "Working", onDone, onFailed, stay = false, hold = HOLD_MS, className, disabled, ...rest }: {
  run: () => Promise<ActionResult>;
  doneLabel: string;
  workingLabel?: string;
  onDone?: (() => void) | undefined;
  /** The reason it did not go through, for the caller to show beside the button (it is also read out, and is the button's tooltip). */
  onFailed?: ((why: string) => void) | undefined;
  /** Keep showing "done" (the thing can only be done once, such as a signature). */
  stay?: boolean;
  /** How long the tick is shown before `onDone`. Shorter where the thing itself then leaves (a row of a list). */
  hold?: number;
  children: ReactNode;
} & Omit<ButtonProps, "onClick" | "children">) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [why, setWhy] = useState<string | null>(null);
  const timer = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; window.clearTimeout(timer.current); }; }, []);

  const press = async () => {
    if (phase === "working" || (phase === "done" && stay)) return;
    if (disabled) return;
    window.clearTimeout(timer.current);
    setWhy(null);
    setPhase("working");
    let error: string | null = null;
    try {
      const r = await run();
      error = r && r.error ? r.error : null;
    } catch (e) {
      error = e instanceof Error ? e.message : "That did not go through.";
    }
    if (!alive.current) return;
    if (error) { setWhy(error); setPhase("failed"); onFailed?.(error); return; }
    setPhase("done");
    timer.current = window.setTimeout(() => { onDone?.(); if (alive.current && !stay) setPhase("idle"); }, hold);
  };

  // The button keeps its name whatever it shows, so it can always be found and asked for by that name; what it is doing is
  // said beside it, as a status, and never becomes part of the name.
  return (
    <>
      <Button {...rest} className={`action-btn${className ? ` ${className}` : ""}`} data-phase={phase} aria-busy={phase === "working" || undefined} aria-disabled={phase === "working" || disabled || undefined} disabled={disabled && phase !== "working" && phase !== "done"} title={why ?? rest.title} onClick={() => void press()}>
        <span className="action-face action-idle">{children}</span>
        <span className="action-face action-working" aria-hidden="true"><i /><i /><i /></span>
        <span className="action-face action-done" aria-hidden="true">{phase === "done" && <Tick />} {doneLabel}</span>
      </Button>
      <span className="sr-only" role="status">{phase === "working" ? workingLabel : phase === "done" ? doneLabel : phase === "failed" ? `Not done: ${why}` : ""}</span>
    </>
  );
}
