"use client";

import { useSyncExternalStore } from "react";

/**
 * Time of day for the whole building. It is a per-browser setting (the office, corridor, every room and the client room all
 * follow it) kept in localStorage and mirrored onto <html data-lighting> so the stylesheet can react without re-rendering.
 * Night is the default and the server render; a stored "day" fades in after mount.
 */
export type Lighting = "night" | "day";
const KEY = "cc-lighting";
const listeners = new Set<() => void>();

function read(): Lighting {
  try {
    return localStorage.getItem(KEY) === "day" ? "day" : "night";
  } catch {
    return "night";
  }
}

export function applyLighting(l: Lighting) {
  document.documentElement.dataset["lighting"] = l;
}

export function setLighting(l: Lighting) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // Private mode or blocked storage: the choice still holds for this tab through the attribute and the listeners.
  }
  applyLighting(l);
  listeners.forEach((f) => f());
}

export function useLighting(): Lighting {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      window.addEventListener("storage", onChange);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => (document.documentElement.dataset["lighting"] === "day" ? "day" : read()),
    () => "night",
  );
}
