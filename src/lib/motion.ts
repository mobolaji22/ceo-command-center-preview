"use client";

import { useSyncExternalStore } from "react";

/**
 * Motion vocabulary for the agency. Durations and easings live in CSS (src/app/motion.css) so the stylesheet
 * and the scripts that wait on it agree; this file holds the few numbers scripts need, and the reduced-motion switch.
 *
 * Three layers (see .lovable/plan/the-living-agency-visual-and-interaction-plan):
 *   feedback   ~130ms  hover / focus / press
 *   threshold  ~300ms  a doorway: corridor <-> room, office <-> desk
 *   reveal     ~380ms  the destination settling in once it is legible
 */
export const THRESHOLD_MS = 300;

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

/** True when the person has asked their system for less motion. Travel and parallax become immediate state changes. */
export const useReducedMotion = (): boolean => useMedia("(prefers-reduced-motion: reduce)");
