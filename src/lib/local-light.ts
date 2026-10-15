"use client";

import { useEffect, useState } from "react";
import type { Lighting } from "./lighting";

/**
 * The lobby keeps the visitor's own time: daylight from 07:00 to 19:00 on their clock, night otherwise. Night is the server
 * render and the first paint, so a daytime visitor sees the lights come up as the page settles. Checked again every minute,
 * so a page left open across dusk changes with it. The building's own day/night setting takes over after sign-in.
 */
export const DAY_FROM = 7;
export const NIGHT_FROM = 19;
export const lightAt = (d: Date): Lighting => (d.getHours() >= DAY_FROM && d.getHours() < NIGHT_FROM ? "day" : "night");

export function useLocalLight(): { lighting: Lighting; now: Date | null } {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return { lighting: now ? lightAt(now) : "night", now };
}
