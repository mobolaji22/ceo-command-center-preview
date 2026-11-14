"use client";

import { useSyncExternalStore } from "react";

/**
 * Motion vocabulary for the agency. Durations and easings live in CSS (src/app/motion.css) so the stylesheet
 * and the scripts that wait on it agree; this file holds the few numbers scripts need, and the reduced-motion switch.
 *
 * Three layers (see .lovable/plan/the-living-agency-visual-and-interaction-plan), on the signature kit's durations:
 *   feedback   150ms  hover / focus / press
 *   threshold  280ms  a doorway: corridor <-> room, office <-> desk
 *   reveal     280ms  the destination settling in once it is legible
 */
export const THRESHOLD_MS = 280;

/** Which way a scene was entered. "none" is the first paint, which never animates. */
export type SceneDir = "none" | "forward" | "back" | "next" | "prev" | "side";

/** Live result of a media query (false on the server). Used for reduced motion and for "has a real pointer". */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * True when the person has asked for less motion, through their system or through the Command Center's own switch. Travel and
 * parallax become immediate state changes.
 */
export function useReducedMotion(): boolean {
  const system = useMedia("(prefers-reduced-motion: reduce)");
  return useMotionPref() === "off" || system;
}

/**
 * The person's own motion choice, beside their system's: "system" follows the device, "off" stills everything. A per-browser
 * setting (like the lighting), kept in localStorage and mirrored onto <html data-motion> so the stylesheet answers without a
 * re-render. "system" is the default and the server render.
 */
export type MotionPref = "system" | "off";
const MOTION_KEY = "cc-motion";
const motionListeners = new Set<() => void>();

function readMotion(): MotionPref {
  try {
    return localStorage.getItem(MOTION_KEY) === "off" ? "off" : "system";
  } catch {
    return "system";
  }
}

export function applyMotionPref(p: MotionPref) {
  if (p === "off") document.documentElement.dataset["motion"] = "off";
  else delete document.documentElement.dataset["motion"];
}

export function setMotionPref(p: MotionPref) {
  try {
    localStorage.setItem(MOTION_KEY, p);
  } catch {
    // Private mode or blocked storage: the choice still holds for this tab through the attribute and the listeners.
  }
  applyMotionPref(p);
  motionListeners.forEach((f) => f());
}

export function useMotionPref(): MotionPref {
  return useSyncExternalStore(
    (onChange) => {
      motionListeners.add(onChange);
      window.addEventListener("storage", onChange);
      return () => {
        motionListeners.delete(onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => (document.documentElement.dataset["motion"] === "off" ? "off" : readMotion()),
    () => "system",
  );
}

/** Outside React (a click handler, a helper): is motion off right now, by the device or by the person's own choice. */
export function motionIsOff(): boolean {
  if (typeof window === "undefined") return true;
  return document.documentElement.dataset["motion"] === "off" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Change what is on screen as one continuous move: the browser photographs before and after and carries each named element
 * (`view-transition-name`) from its old place to its new one, so a row that moved slides, one that left fades, and a thing
 * that became another thing grows into it. Where the browser has no View Transitions, or motion is off, the change is simply
 * made. `change` must apply the new state synchronously (wrap a React state update in `flushSync`).
 *
 * The browser makes the change a frame later, after its first photograph, so the promise says when it has been made. Anything
 * that must follow the change (the answer from the API replacing "recording" with "recorded") waits for it; otherwise a quick
 * answer lands first and the change then writes over it.
 */
export function carry(change: () => void): Promise<void> {
  const doc = typeof document === "undefined" ? undefined : (document as Document & { startViewTransition?: (cb: () => void) => { updateCallbackDone: Promise<void> } });
  if (!doc?.startViewTransition || motionIsOff()) { change(); return Promise.resolve(); }
  return doc.startViewTransition(change).updateCallbackDone;
}
