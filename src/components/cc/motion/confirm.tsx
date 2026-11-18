"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Tick } from "./tick";

/** How long a confirmation is shown, and how long its leaving takes (it leaves faster than it arrives). */
const SHOW_MS = 2600;
const LEAVE_MS = 150;

type Note = { id: number; text: string };
let current: Note | null = null;
let seq = 0;
const listeners = new Set<() => void>();

/**
 * Say, briefly, that a small thing was done ("Link copied", "Saved"). One line at the foot of the screen, replaced by the next
 * one; it is a status, so it is read out without taking focus. For anything that matters (an approval, a failure) the outcome
 * belongs on the control that caused it, not here.
 */
export function confirm(text: string) {
  current = { id: ++seq, text };
  listeners.forEach((f) => f());
}

function useNote(): Note | null {
  return useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, () => current, () => null);
}

/** Where confirmations appear. Mounted once, at the root. */
export function ConfirmHost() {
  const note = useNote();
  const [leaving, setLeaving] = useState<number | null>(null);
  useEffect(() => {
    if (!note) return;
    const go = window.setTimeout(() => setLeaving(note.id), SHOW_MS);
    const gone = window.setTimeout(() => { if (current?.id === note.id) { current = null; listeners.forEach((f) => f()); } }, SHOW_MS + LEAVE_MS);
    return () => { window.clearTimeout(go); window.clearTimeout(gone); };
  }, [note]);
  return (
    // A live region, always present so what arrives in it is read out, but not a "status": a screen's own status line stays
    // the one status on it, and this host is empty almost all the time.
    <div className="confirm-host" aria-live="polite" aria-atomic="true">
      {note && <p key={note.id} className="confirm-note" data-leaving={leaving === note.id || undefined}><Tick size={14} /> {note.text}</p>}
    </div>
  );
}
