"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import type { Result } from "@/lib/data/types";

/**
 * Sensitive actions (inviting someone) need a fresh proof that it is still you. When the server asks, this emails a code
 * to the signed-in person, shows a small box to enter it, and then repeats the action that was interrupted.
 */
export function useStepUp() {
  const ds = useDataSource();
  const pending = useRef<null | (() => Promise<Result<unknown>>)>(null);
  const [asking, setAsking] = useState(false);
  const [code, setCode] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Runs the action. Returns its result; if a step-up was needed it shows the box and returns null (nothing happened yet). */
  async function guard<T>(action: () => Promise<Result<T>>, onDone: (r: Result<T>) => void): Promise<void> {
    const r = await action();
    if (r.error?.code === "STEP_UP_REQUIRED") {
      pending.current = async () => { const again = await action(); onDone(again); return again; };
      setAsking(true); setCode(""); setNote(null);
      const sent = await ds.auth.requestStepUp();
      setNote(sent.error ? sent.error.message : "We emailed you a six-digit code. Enter it to continue.");
      return;
    }
    onDone(r);
  }

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const r = await ds.auth.verifyStepUp(code.trim());
    if (r.error) { setBusy(false); setNote(r.error.message); return; }
    const retry = pending.current; pending.current = null;
    setAsking(false); setBusy(false);
    await retry?.();
  };

  const panel: ReactNode = asking ? (
    <form className="mform" onSubmit={confirm} aria-label="Confirm it's you">
      <h4>Confirm it&apos;s you</h4>
      {note && <p className="mmsg">{note}</p>}
      <input inputMode="numeric" pattern="[0-9]{6}" required placeholder="Six-digit code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" />
      <Button className="approve-btn" type="submit" disabled={busy}>Confirm</Button>
      <Button type="button" variant="ghost" onClick={() => { setAsking(false); pending.current = null; }}>Cancel</Button>
    </form>
  ) : null;

  return { guard, panel };
}
