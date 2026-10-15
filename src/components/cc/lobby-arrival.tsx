"use client";

import { useEffect, useState } from "react";

/**
 * The far side of the walk from the lobby (lobby.tsx): the hall opens from the passage, an iris widening from the middle of the
 * screen, so the zoom into the passage carries on into the room instead of cutting to it. It plays once, only on the page the lobby
 * opened (the lobby leaves a note for this tab), never on an ordinary visit or reload, and never with reduced motion (the lobby
 * leaves no note then). It only ever scales one layer, so the browser composites it.
 */
export const ARRIVAL_KEY = "cc-arrival";

export function LobbyArrival() {
  // Read before the first paint of the room, so it never shows unveiled for a frame first.
  const [arriving, setArriving] = useState(() => {
    try { return typeof window !== "undefined" && sessionStorage.getItem(ARRIVAL_KEY) === "lobby"; } catch { return false; }
  });
  useEffect(() => {
    try { sessionStorage.removeItem(ARRIVAL_KEY); } catch { /* storage blocked: nothing was noted */ }
  }, []);
  if (!arriving) return null;
  return <div className="lobby-arrival" aria-hidden="true" onAnimationEnd={(e) => { if (e.target === e.currentTarget) setArriving(false); }} />;
}
