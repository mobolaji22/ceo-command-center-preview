"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ArrowRight, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { pad } from "@/lib/format";
import { THRESHOLD_MS, useReducedMotion } from "@/lib/motion";
import { LitImage } from "./lit-image";
import { CORRIDOR_ART, roomArt } from "./room-art";

export type HallDoor = { code: string; name: string; active: number; icon: LucideIcon };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Walk-the-hall navigation. The doors sit on a native horizontally scrolling track, so touch swipe, inertia, snapping, keyboard
 * focus and Playwright's scrollIntoView all work without being re-implemented. Script only adds what the browser does not:
 *   - parallax and depth, driven by CSS variables written on scroll (--hall-p on the stage, --d / --n on each door)
 *   - mouse drag with a fling, and the vertical mouse wheel as steps
 *   - arrow keys moving focus door to door
 *   - the push-in: the stage scales toward the door that was chosen, then the room mounts (THRESHOLD_MS later)
 * Every door is a real button that enters its room in one activation, whether or not it is the centred one.
 */
export function Hall({ doors, startAt, onEnter }: { doors: HallDoor[]; startAt?: string | undefined; onEnter: (code: string) => void }) {
  const reduced = useReducedMotion();
  const n = doors.length;
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const doorRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rafRef = useRef(0);
  const timerRef = useRef(0);
  const leavingRef = useRef<number | null>(null);
  const suppressClick = useRef(false);

  const startIndex = Math.max(0, startAt ? doors.findIndex((d) => d.code === startAt) : 0);
  const [active, setActive] = useState(startIndex);
  const activeRef = useRef(startIndex);
  const [settled, setSettled] = useState(startIndex);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);

  const targetLeft = useCallback((i: number) => {
    const track = trackRef.current;
    const el = doorRefs.current[i];
    return track && el ? el.offsetLeft + el.offsetWidth / 2 - track.clientWidth / 2 : 0;
  }, []);

  /** Read the track once per frame; write the depth variables the stylesheet turns into tilt, dimming and parallax. */
  const update = useCallback(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) return;
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    doorRefs.current.forEach((el, i) => {
      if (!el) return;
      const d = (el.offsetLeft + el.offsetWidth / 2 - mid) / el.offsetWidth;
      el.style.setProperty("--d", d.toFixed(3));
      el.style.setProperty("--n", Math.min(Math.abs(d), 2).toFixed(3));
      if (Math.abs(d) < bestDist) {
        bestDist = Math.abs(d);
        best = i;
      }
    });
    const max = track.scrollWidth - track.clientWidth;
    stage.style.setProperty("--hall-p", (max > 0 ? track.scrollLeft / max : 0).toFixed(4));
    activeRef.current = best;
    setActive(best);
  }, []);

  const onScroll = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      update();
    });
  };

  const walk = useCallback(
    (i: number, instant = false) => {
      const track = trackRef.current;
      if (!track) return;
      track.scrollTo({ left: targetLeft(clamp(i, 0, n - 1)), behavior: instant || reduced ? "auto" : "smooth" });
    },
    [n, reduced, targetLeft],
  );

  // Arrive standing at the door you came out of (or the first door), and stay centred if the window is resized.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollLeft = targetLeft(startIndex);
    update();
    const ro = new ResizeObserver(() => {
      track.scrollLeft = targetLeft(activeRef.current);
      update();
    });
    ro.observe(track);
    return () => ro.disconnect();
  }, [startIndex, targetLeft, update]);

  // The announcement waits until the walk has settled so a screen reader is not read every door that was passed.
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(active), 220);
    return () => window.clearTimeout(t);
  }, [active]);

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // The vertical wheel steps door to door while the hall can still move that way; at either end the page keeps its own scroll.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let acc = 0;
    let lock = 0;
    let idle = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const next = activeRef.current + dir;
      if (next < 0 || next > n - 1) return;
      e.preventDefault();
      setTouched(true);
      const now = performance.now();
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        acc = 0;
      }, 160);
      if (now < lock) return;
      acc += e.deltaY;
      if (Math.abs(acc) >= 48) {
        acc = 0;
        lock = now + 380;
        walk(next);
      }
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", onWheel);
      window.clearTimeout(idle);
    };
  }, [n, walk]);

  // Mouse drag with a fling. Touch and pen scroll natively. No pointer capture, so a plain click still reaches the door.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const track = trackRef.current;
    if (!track) return;
    const s = { x: e.clientX, left: track.scrollLeft, moved: false, lastX: e.clientX, lastT: performance.now(), v: 0 };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - s.x;
      if (!s.moved && Math.abs(dx) < 6) return;
      if (!s.moved) {
        s.moved = true;
        track.classList.add("is-dragging");
        setTouched(true);
      }
      track.scrollLeft = s.left - dx;
      const now = performance.now();
      if (now > s.lastT) s.v = (ev.clientX - s.lastX) / (now - s.lastT);
      s.lastX = ev.clientX;
      s.lastT = now;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!s.moved) return;
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      const projected = track.scrollLeft - s.v * 220;
      let best = 0;
      let bestGap = Infinity;
      doorRefs.current.forEach((el, i) => {
        if (!el) return;
        const gap = Math.abs(targetLeft(i) - projected);
        if (gap < bestGap) {
          bestGap = gap;
          best = i;
        }
      });
      walk(best);
      window.setTimeout(() => track.classList.remove("is-dragging"), 420);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const focused = doorRefs.current.findIndex((el) => el === document.activeElement);
    const from = focused >= 0 ? focused : activeRef.current;
    let to: number;
    if (e.key === "ArrowRight") to = from + 1;
    else if (e.key === "ArrowLeft") to = from - 1;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = n - 1;
    else return;
    e.preventDefault();
    setTouched(true);
    to = clamp(to, 0, n - 1);
    doorRefs.current[to]?.focus({ preventScroll: true });
    walk(to);
  };

  /** One activation enters the room. Reduced motion goes straight in; otherwise the camera pushes through the door first. */
  const open = (i: number) => {
    if (suppressClick.current || leavingRef.current !== null) return;
    const door = doors[i];
    if (!door) return;
    if (reduced) {
      onEnter(door.code);
      return;
    }
    leavingRef.current = i;
    setLeaving(i);
    const el = doorRefs.current[i];
    const stage = stageRef.current;
    if (el && stage) {
      const r = el.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      stage.style.setProperty("--ox", `${r.left + r.width / 2 - s.left}px`);
      stage.style.setProperty("--oy", `${r.top + r.height * 0.5 - s.top}px`);
    }
    timerRef.current = window.setTimeout(() => onEnter(door.code), THRESHOLD_MS);
  };

  const here = doors[settled];
  const announce = here ? `${here.name}, room ${settled + 1} of ${n}. ${here.active ? `${here.active} active project${here.active === 1 ? "" : "s"}.` : "Quiet."}` : "";

  return (
    <div className="hall">
      <div ref={stageRef} className="hall-stage" data-leaving={leaving !== null || undefined} data-arrive={startAt ? "" : undefined} data-touched={touched || undefined}>
        <div className="hall-scene">
          <div className="hall-backdrop" aria-hidden="true">
            <LitImage art={CORRIDOR_ART} sizes="120vw" />
          </div>
          <div className="hall-shade" aria-hidden="true" />
          <div className="hall-floor" aria-hidden="true" />
          <div ref={trackRef} className="hall-track" role="group" aria-label="Rooms along the corridor" onScroll={onScroll} onPointerDown={onPointerDown} onClickCapture={(e) => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); } }} onKeyDown={onKeyDown}>
            {doors.map((d, i) => {
              const Icon = d.icon;
              const art = roomArt(d.code);
              const isActive = i === active;
              return (
                <button
                  key={d.code}
                  ref={(el) => {
                    doorRefs.current[i] = el;
                  }}
                  type="button"
                  className="door-card hall-door"
                  style={{ "--i": i } as CSSProperties}
                  data-active={isActive || undefined}
                  data-quiet={d.active === 0 || undefined}
                  data-leaving={leaving === i || undefined}
                  aria-label={`${d.name}, room ${i + 1} of ${n}. ${d.active ? `${d.active} active project${d.active === 1 ? "" : "s"}` : "Quiet"}. Enter room`}
                  onClick={() => open(i)}
                  onFocus={(e) => {
                    if (e.currentTarget.matches(":focus-visible") && i !== activeRef.current) walk(i);
                  }}
                >
                  <span className="door-sconce" aria-hidden="true" />
                  <span className="door-body">
                    <span className="door-leaf">
                      {art && Math.abs(i - active) <= 1 && (
                        <span className="door-peek" aria-hidden="true">
                          <LitImage art={art} sizes="260px" quality={55} />
                        </span>
                      )}
                      <span className="door-panels" aria-hidden="true"><i /><i /></span>
                      <span className="door-number">{pad(i + 1)}</span>
                      <span className="door-icon"><Icon size={26} strokeWidth={1.3} /></span>
                      <span className="door-knob" aria-hidden="true" />
                    </span>
                    <span className="door-plate">
                      <span className="door-name">{d.name}</span>
                      <span className={`pill ${d.active ? "green" : "muted"}`}>{d.active ? `● ${d.active} ACTIVE` : "QUIET"}</span>
                    </span>
                  </span>
                  <span className="door-enter">ENTER ROOM <ArrowRight size={15} /></span>
                </button>
              );
            })}
          </div>
        </div>
        <button type="button" className="hall-arrow hall-arrow-prev" aria-label="Walk to the previous room" disabled={active === 0} onClick={() => { setTouched(true); walk(activeRef.current - 1); }}><ChevronLeft size={20} /></button>
        <button type="button" className="hall-arrow hall-arrow-next" aria-label="Walk to the next room" disabled={active === n - 1} onClick={() => { setTouched(true); walk(activeRef.current + 1); }}><ChevronRight size={20} /></button>
      </div>
      <div className="hall-status">
        <span className="hall-where" aria-hidden="true"><b>{pad(active + 1)}</b> / {pad(n)}<span>{doors[active]?.name}</span></span>
        <nav className="hall-index" aria-label="Jump to a room">
          {doors.map((d, i) => (
            <button key={d.code} type="button" className="hall-chip" data-active={i === active || undefined} aria-label={`Walk to ${d.name}`} title={d.name} onClick={() => { setTouched(true); walk(i); }}>{pad(i + 1)}</button>
          ))}
        </nav>
        <span className="hall-hint">Drag, scroll, or use the arrow keys to walk the hall.</span>
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>
    </div>
  );
}
