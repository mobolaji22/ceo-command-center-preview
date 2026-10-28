"use client";

import { useEffect, useRef } from "react";

/**
 * Where you are in a room, kept in the address bar, so Back and Forward walk the way you came, a refresh opens the same desk, and a
 * link can point at one desk (`?desk=contracts&project=…`, `?room=DESIGN&spot=workshop`). Only these keys are ours; anything else
 * in the address (the demo's `?as=`) is left as it is. The URL is written with the browser's own history (Next.js keeps its router
 * in step with it), so moving between desks never reloads anything.
 */
export const PLACE_KEYS = ["desk", "project", "item", "at", "room", "spot"] as const;
export type PlaceKey = (typeof PLACE_KEYS)[number];
export type Place = { [K in PlaceKey]?: string | undefined };

/** The place in the current address. Empty in the office. */
export function readPlace(): Place {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const place: Place = {};
  for (const k of PLACE_KEYS) { const v = params.get(k); if (v) place[k] = v; }
  return place;
}

/** Writes a place into the address as a new history entry, unless the address already says it. */
export function writePlace(place: Place) {
  const params = new URLSearchParams(window.location.search);
  for (const k of PLACE_KEYS) { const v = place[k]; if (v) params.set(k, v); else params.delete(k); }
  const query = params.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  window.history.pushState(null, "", next);
}

/** Calls `onPlace` once on arrival (a link or a refresh) and again whenever Back or Forward changes the address. */
export function usePlaceFromHistory(onPlace: (place: Place) => void) {
  // The newest handler, so a Back press is judged against where you are now (it decides which way the scene moves).
  const latest = useRef(onPlace);
  useEffect(() => { latest.current = onPlace; });
  useEffect(() => {
    latest.current(readPlace());
    const pop = () => latest.current(readPlace());
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
}
