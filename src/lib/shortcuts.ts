"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Keyboard shortcuts for the office and the client room. Two kinds:
 *  - ⌘K / Ctrl K opens the palette from anywhere, always.
 *  - Single letters (C for contracts, ? for the list, …) only when nothing is being typed into, no modifier is held, no dialog of
 *    its own is open, and the Design Workshop does not have the keyboard (it has its own keys). They can be switched off, because a
 *    single letter can clash with a screen reader's own keys; the choice is a per-browser preference kept like the lighting.
 */
const KEY = "dpl.single-keys";
const listeners = new Set<() => void>();

function read(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

export function setSingleKeys(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* private window: the choice lasts this visit */ }
  listeners.forEach((f) => f());
}

export function useSingleKeys(): boolean {
  return useSyncExternalStore(
    (onChange) => { listeners.add(onChange); window.addEventListener("storage", onChange); return () => { listeners.delete(onChange); window.removeEventListener("storage", onChange); }; },
    read,
    () => true,
  );
}

/** True when a key press belongs to what has focus: a field, an editable area, or the Design Workshop. */
export function belongsToFocus(e: KeyboardEvent): boolean {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return false;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || t.closest('[data-desk="workshop"]') !== null;
}

/** True when a dialog of its own (the palette, the shortcut list, a confirmation) is open over the room. */
export const dialogOpen = () => document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]') !== null;

/** A single, unmodified key press that is free for a shortcut. */
export function isFreeKey(e: KeyboardEvent): boolean {
  return !e.metaKey && !e.ctrlKey && !e.altKey && !e.defaultPrevented && !belongsToFocus(e) && !dialogOpen();
}

/** The palette's key: ⌘K on a Mac, Ctrl K elsewhere. */
export const isPaletteKey = (e: KeyboardEvent) => (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k";

/** Listens on the window. `capture` runs before the room's own handlers (a desk's Escape), so a desk can claim a key first. */
export function useWindowKeys(handler: (e: KeyboardEvent) => void, capture = false) {
  const latest = useRef(handler);
  useEffect(() => { latest.current = handler; });
  useEffect(() => {
    const on = (e: KeyboardEvent) => latest.current(e);
    window.addEventListener("keydown", on, capture);
    return () => window.removeEventListener("keydown", on, capture);
  }, [capture]);
}

/** How a key is written on screen. */
export const keyLabel = (k: string) => (k.length === 1 ? k.toUpperCase() : k);
