"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { SceneDir } from "@/lib/motion";

/**
 * How deep each screen sits in the building. Going deeper is "forward" (through a door), shallower is "back" (out of one),
 * and the same depth is a step to the side. Rooms beside each other slide the way the corridor runs (next / prev).
 */
const DEPTH: Record<string, number> = { office: 0, hallway: 1, computer: 1, phone: 1, contracts: 1, directive: 1, brief: 1, manage: 1, room: 2, roomdesk: 3 };

/** Desks open over their room rather than replacing it; moving between a room and its desk is not a change of scene. */
export const isOverlayMove = (from: string, to: string, desks: readonly string[], stage: string) => (from === stage && desks.includes(to)) || (to === stage && desks.includes(from));

export function directionBetween(from: string, to: string): SceneDir {
  const a = DEPTH[from] ?? 1;
  const b = DEPTH[to] ?? 1;
  return b > a ? "forward" : b < a ? "back" : "side";
}

/**
 * Wraps one screen. A new key remounts it, which plays the entrance for the direction it was reached from. After the first
 * paint it also puts the reader at the top and moves focus to the frame, so keyboard and screen reader users land at the start
 * of the destination instead of wherever the old screen left them (never on the very first paint, which has no direction).
 */
export type SceneOrigin = { x: number; y: number };

export function SceneFrame({ sceneKey, dir, origin, inert, children }: { sceneKey: string; dir: SceneDir; origin?: SceneOrigin | undefined; /** The scene is behind an open desk: out of the tab order and the accessibility tree, but still drawn. */ inert?: boolean | undefined; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // "none" is the first paint of the session: nothing has been left behind, so there is nothing to reset.
    if (dir === "none") return;
    window.scrollTo(0, 0);
    ref.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the scene changes, not when only its direction does
  }, [sceneKey]);
  return (
    <div key={sceneKey} ref={ref} tabIndex={-1} inert={inert} aria-hidden={inert || undefined} className={`scene scene-${dir}`} data-origin={origin ? "" : undefined} style={origin ? ({ transformOrigin: `${origin.x}% ${origin.y}%` } as CSSProperties) : undefined}>
      {children}
    </div>
  );
}

/**
 * Where on the office photo each destination's object sits (the same percentages the hotspots use). A desk opens out of its
 * object and folds back into it, so attention travels from the object to its working surface and returns.
 */
const OBJECT_AT: Record<string, SceneOrigin> = {
  hallway: { x: 8, y: 57 }, brief: { x: 34, y: 48 }, contracts: { x: 52, y: 68 }, directive: { x: 63, y: 53 }, phone: { x: 73, y: 74 }, computer: { x: 85, y: 47 },
};
/** The object a transition is about: the destination when going in, the screen being left when coming back out. */
export const originFor = (from: string, to: string): SceneOrigin | undefined => OBJECT_AT[to === "office" ? from : to];

/** A brief wash of light over the screen change. It never takes pointer events, so nothing waits on it. */
export function ThresholdVeil({ sceneKey, dir, origin }: { sceneKey: string; dir: SceneDir; origin?: SceneOrigin | undefined }) {
  if (dir === "none") return null;
  return <div key={sceneKey} className={`veil veil-${dir}`} aria-hidden="true" style={origin ? ({ "--vx": `${origin.x}%`, "--vy": `${origin.y}%` } as CSSProperties) : undefined} />;
}
