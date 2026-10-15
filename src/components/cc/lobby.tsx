"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocalLight } from "@/lib/local-light";
import { useMedia, useReducedMotion } from "@/lib/motion";
import { LitImage } from "./lit-image";
import { LOBBY_ART } from "./room-art";

/**
 * The street entrance, where every way in begins (sign-in, an emailed link, an invitation). The photograph keeps the visitor's own
 * time of day and answers the pointer with a little depth; the lights in it (the sign, the lamp, the sconces, the street through
 * the doors) are drawn over the places they are in the picture. Arriving, the camera settles in from the street; once signed in,
 * it walks to "Rooms 01-13" and into the building before the next page opens. It is atmosphere only: every word and control is
 * HTML in the visitor card, and with reduced motion nothing travels.
 */
type Phase = "arriving" | "idle" | "leaving";
type LobbyApi = {
  /** Plays the walk into the building, then calls `then` (at once with reduced motion). */
  leave: (then: () => void) => void;
  /** The building notices someone at the desk: the sign brightens while the card has focus. */
  attend: (on: boolean) => void;
  reduced: boolean;
};
const LobbyContext = createContext<LobbyApi>({ leave: (then) => then(), attend: () => {}, reduced: true });
export const useLobby = () => useContext(LobbyContext);

/** How long the walk into the building takes before the next page opens. Matches lobby-leave in lobby.css. */
const LEAVE_MS = 950;
const ARRIVE_MS = 1700;

export function Lobby({ children }: { children: ReactNode }) {
  const { lighting, now } = useLocalLight();
  const reduced = useReducedMotion();
  const fine = useMedia("(hover: hover) and (pointer: fine)");
  const [phase, setPhase] = useState<Phase>("arriving");
  const [attending, setAttending] = useState(false);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setPhase((p) => (p === "arriving" ? "idle" : p)), reduced ? 0 : ARRIVE_MS);
    return () => window.clearTimeout(t);
  }, [reduced]);

  // Depth: the room drifts against the pointer and the card a little with it, eased so it reads as looking around, not dragging.
  useEffect(() => {
    const el = root.current;
    if (!el || reduced || !fine) return;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let raf = 0;
    const step = () => {
      cur.x += (target.x - cur.x) * 0.08;
      cur.y += (target.y - cur.y) * 0.08;
      el.style.setProperty("--px", cur.x.toFixed(4));
      el.style.setProperty("--py", cur.y.toFixed(4));
      raf = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.0005 ? requestAnimationFrame(step) : 0;
    };
    const move = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(step);
    };
    const away = () => { target.x = 0; target.y = 0; if (!raf) raf = requestAnimationFrame(step); };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", away);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", away);
      cancelAnimationFrame(raf);
    };
  }, [reduced, fine]);

  const leave = useCallback((then: () => void) => {
    if (reduced) { then(); return; }
    setPhase("leaving");
    window.setTimeout(then, LEAVE_MS);
  }, [reduced]);
  const api = useMemo<LobbyApi>(() => ({ leave, attend: setAttending, reduced }), [leave, reduced]);

  const time = now ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(now) : null;
  const part = now ? (now.getHours() < 5 ? "Late" : now.getHours() < 12 ? "Morning" : now.getHours() < 17 ? "Afternoon" : now.getHours() < 21 ? "Evening" : "Late") : null;

  return <LobbyContext.Provider value={api}>
    <main ref={root} className="lobby" data-lit={lighting} data-phase={phase} data-attend={attending ? "" : undefined}>
      <div className="lobby-frame" aria-hidden="true">
        {/* walk: arriving from the street and leaving for the rooms; cam: looking around with the pointer */}
        <div className="lobby-walk"><div className="lobby-cam">
          <LitImage art={LOBBY_ART} lighting={lighting} sizes="(orientation: portrait) 220vw, 112vw" className="lobby-photo" />
          <span className="lobby-street" />
          <span className="lobby-beam" />
          <span className="lobby-glow lobby-glow-sign" />
          <span className="lobby-glow lobby-glow-lamp" />
          <span className="lobby-glow lobby-glow-sconce lobby-glow-sconce-a" />
          <span className="lobby-glow lobby-glow-sconce lobby-glow-sconce-b" />
          <span className="lobby-glow lobby-glow-rooms" />
          {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="lobby-mote" style={{ ["--i" as string]: i }} />)}
        </div></div>
      </div>
      <div className="lobby-shade" aria-hidden="true" />
      <header className="lobby-plaque">
        <span className="brand-mark"><span /></span>
        <span className="lobby-plaque-name">DEVPLAYBOOK <em>/</em> V4</span>
        {time && <span className="lobby-plaque-time" aria-hidden="true"><i />{part} · {time}</span>}
      </header>
      <div className="lobby-desk">{children}</div>
      <div className="lobby-fade" aria-hidden="true" />
    </main>
  </LobbyContext.Provider>;
}

/**
 * The visitor card: a glass panel with a brass edge. It tells the lobby when someone is at it (the sign brightens), and shakes once
 * when `shake` changes, so a refused answer is felt as well as read.
 */
export function VisitorCard({ children, eyebrow, onSubmit, shake }: { children: ReactNode; eyebrow: string; onSubmit?: ((e: React.FormEvent) => void) | undefined; shake?: number | undefined }) {
  const { attend } = useLobby();
  const props = {
    className: "lobby-card",
    "data-shake": shake ? shake % 2 : undefined,
    onFocus: () => attend(true),
    onBlur: (e: React.FocusEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) attend(false); },
  };
  const body = <>
    <div className="lobby-card-plate"><span>{eyebrow}</span><i /></div>
    {children}
  </>;
  return onSubmit ? <form {...props} onSubmit={onSubmit}>{body}</form> : <div {...props}>{body}</div>;
}

/**
 * The six-digit code as six brass tiles. Underneath it is one ordinary input (one label, the phone's one-time-code autofill, paste
 * of the whole code, the number keypad), laid invisibly over the tiles; the tiles only show what it holds and where the next digit goes.
 */
export function CodeTiles({ value, onChange, state, autoFocus }: { value: string; onChange: (v: string) => void; state: "idle" | "checking" | "accepted"; autoFocus?: boolean }) {
  const [focused, setFocused] = useState(false);
  const next = Math.min(value.length, 5);
  return <span className="code-tiles" data-state={state}>
    <input
      className="code-tiles-input" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" autoFocus={autoFocus}
      value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} spellCheck={false}
    />
    <span className="code-tiles-row" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="code-tile" style={{ ["--i" as string]: i }} data-filled={value[i] ? "" : undefined} data-next={focused && i === next && value.length < 6 ? "" : undefined}>{value[i] ?? ""}</span>)}
    </span>
  </span>;
}

/** A sealed envelope that leaves the card for the street when the link is sent. Re-mount (change `key`) to send another. */
export function Envelope() {
  return <span className="lobby-envelope" aria-hidden="true">
    <svg viewBox="0 0 48 34" width="48" height="34"><rect x="1" y="1" width="46" height="32" rx="2" /><path d="M2 3 L24 19 L46 3" /><circle cx="24" cy="19" r="4.5" /></svg>
  </span>;
}
