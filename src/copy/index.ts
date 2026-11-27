import floor from "./floor.json";
import room from "./room.json";
import studio from "./studio.json";

/**
 * The Command Center's own words, one file per surface (v4 ADR-0099 Decision 12), so the studio's voice, or another agency's, changes in
 * one place. `npm run lint` reads every string here against v4's work standard and literal-copy patterns (scripts/check-copy.mjs).
 * A screen takes its words from here and fills a `{name}` slot with `say`; it never writes a sentence of its own.
 */
export const COPY = { studio, floor, room } as const;

/** Fills each `{name}` slot. A slot the screen does not fill stays visible, so a missing value shows in review instead of vanishing. */
export const say = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
