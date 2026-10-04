import type { Session } from "./model";

/**
 * Where a person was heading when they had to sign in. An email links to a page (a brief); the page needs a session; signing in
 * happens through another emailed link, usually in another tab, so the destination is kept in local storage for a short while rather
 * than in the address. Only the pages an email links to can be remembered, so this can never send anyone somewhere unexpected.
 */
const KEY = "dpl.destination";
const KEEP_MS = 30 * 60_000;
const REMEMBERABLE = /^\/briefs\/[A-Za-z0-9_-]{1,64}$/;

export const homeFor = (s: Session) => (s.role === "owner" ? "/" : "/client");

export function rememberDestination(path: string): void {
  if (!REMEMBERABLE.test(path)) return;
  try { window.localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() })); } catch { /* storage unavailable: they land on their home page */ }
}

/** The remembered destination, once: it is forgotten as it is read, and forgotten if it is old. */
export function takeDestination(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    window.localStorage.removeItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    return typeof path === "string" && typeof at === "number" && Date.now() - at < KEEP_MS && REMEMBERABLE.test(path) ? path : null;
  } catch { return null; }
}

/** Where to go after signing in: where they were heading, else home. */
export const landingFor = (s: Session): string => takeDestination() ?? homeFor(s);
