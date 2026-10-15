"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocalLight } from "@/lib/local-light";
import { useMedia, useReducedMotion } from "@/lib/motion";
import { LitImage } from "./lit-image";
import { LOBBY_ART } from "./room-art";

/**
 * The street entrance, where every way in begins (sign-in, an emailed link, an invitation). The photograph keeps the visitor's own
 * time of day and answers the pointer with a little depth; the lights in it (the sign, the lamp, the sconces, the street through
 * the doors) are drawn over the places they are in the picture. Arriving, the camera settles in from the street; once signed in,
 * it walks across the lobby to the passage beside "Rooms 01-13" and into it, while the next page loads, and holds there until
 * that page is ready. It is atmosphere only: every word and control is
 * HTML in the visitor card, and with reduced motion nothing travels.
 */
type Phase = "arriving" | "idle" | "leaving" | "entered";
type LobbyApi = {
  /**
   * Walks into the building and opens `href`. The page is fetched as the walk starts and opened when it arrives; the lobby holds
   * the end of the walk until that page is ready, so the walk always reaches the passage before the next page shows. With reduced
   * motion it opens at once.
   */
  leave: (href: string) => void;
  /** The building notices someone at the desk: the sign brightens while the card has focus. */
  attend: (on: boolean) => void;
  reduced: boolean;
};
const LobbyContext = createContext<LobbyApi>({ leave: () => {}, attend: () => {}, reduced: true });
export const useLobby = () => useContext(LobbyContext);

/** How long the walk across the lobby and into the passage takes. Matches lobby-walk in lobby.css. */
const WALK_MS = 1500;
/** Where the passage to the rooms is in the photograph: beside the "Rooms 01-13" plaque, between the panel and the column. */
const PASSAGE = { x: 0.108, y: 0.49 };
/** The resting zoom of .lobby-cam and the reach of its parallax (lobby.css), needed to find the passage on screen. */
const CAM_SCALE = 1.04;
const PARALLAX = { x: 0.012, y: 0.01 };
const ARRIVE_MS = 1700;

export function Lobby({ children }: { children: ReactNode }) {
  const { lighting, now } = useLocalLight();
  const reduced = useReducedMotion();
  const fine = useMedia("(hover: hover) and (pointer: fine)");
  const [phase, setPhase] = useState<Phase>("arriving");
  const [attending, setAttending] = useState(false);
  const root = useRef<HTMLElement>(null);
  /** Set when the walk starts: the room stops following the pointer, so the walk lands where it was aimed. */
  const frozen = useRef(false);

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
      if (frozen.current) { raf = 0; return; }
      cur.x += (target.x - cur.x) * 0.08;
      cur.y += (target.y - cur.y) * 0.08;
      el.style.setProperty("--px", cur.x.toFixed(4));
      el.style.setProperty("--py", cur.y.toFixed(4));
      raf = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.0005 ? requestAnimationFrame(step) : 0;
    };
    const move = (e: PointerEvent) => {
      if (frozen.current) return;
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

  const router = useRouter();
  const leave = useCallback((href: string) => {
    if (reduced) { router.replace(href); return; }
    router.prefetch(href);
    frozen.current = true;
    // Find the passage where it is on screen now (the frame's crop, the camera's zoom and the pointer's parallax all move it), and
    // aim the walk so it arrives there at the centre of the screen.
    const el = root.current;
    const frame = el?.querySelector<HTMLElement>(".lobby-frame");
    if (el && frame) {
      const r = frame.getBoundingClientRect();
      const px = Number(el.style.getPropertyValue("--px") || 0);
      const py = Number(el.style.getPropertyValue("--py") || 0);
      const ox = r.width / 2 + (PASSAGE.x * r.width - r.width / 2) * CAM_SCALE - PARALLAX.x * r.width * px;
      const oy = r.height / 2 + (PASSAGE.y * r.height - r.height / 2) * CAM_SCALE - PARALLAX.y * r.height * py;
      el.style.setProperty("--walk-ox", `${ox.toFixed(1)}px`);
      el.style.setProperty("--walk-oy", `${oy.toFixed(1)}px`);
      el.style.setProperty("--walk-dx", `${(window.innerWidth / 2 - (r.left + ox)).toFixed(1)}px`);
      el.style.setProperty("--walk-dy", `${(window.innerHeight / 2 - (r.top + oy)).toFixed(1)}px`);
    }
    setPhase("leaving");
    // Opened only once the walk has arrived. Until the next page is ready, the lobby stays on screen at the end of the walk.
    window.setTimeout(() => { setPhase("entered"); router.replace(href); }, WALK_MS);
  }, [reduced, router]);
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
      <div className="lobby-ahead" aria-hidden="true" />
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
