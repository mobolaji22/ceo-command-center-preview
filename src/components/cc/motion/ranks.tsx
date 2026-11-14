"use client";

import { useEffect, useState, type HTMLAttributes, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/motion";

/** As long as the collapse in micro.css (`--dur-base`), and a frame. */
const LEAVE_MS = 300;

type Held<T> = { key: string; item: T; leaving: boolean; fresh: boolean };

/** What is on screen: everything in the list now, and each one that has just left, still in the place it had. */
function merge<T>(held: Held<T>[], items: readonly T[], keyOf: (item: T) => string, still: boolean): Held<T>[] {
  const was = new Map(held.map((h) => [h.key, h]));
  const out: Held<T>[] = items.map((item) => { const key = keyOf(item); return { key, item, leaving: false, fresh: was.get(key)?.fresh ?? true }; });
  if (still) return out;
  const now = new Set(out.map((o) => o.key));
  held.forEach((h, i) => {
    if (now.has(h.key)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) { const n = out.findIndex((o) => o.key === held[j]!.key); if (n >= 0) { at = n + 1; break; } }
    out.splice(at, 0, { ...h, leaving: true });
  });
  return out;
}
const mark = <T,>(list: Held<T>[]) => list.map((h) => `${h.key}${h.leaving ? "-" : "+"}`).join("\n");

/**
 * A list that closes ranks. When an item is dealt with, its row closes up where it stood and what is below it rises with it,
 * as one move: the row is kept on screen (out of reach and unannounced) for the moment that takes, then removed. A new item
 * opens its own space and rises into it. The space itself is what moves, so the rest of the page follows it; nothing jumps.
 *
 * Give it the list as it is now, and how to draw one row. `empty` is shown once the last row has gone. With motion off, or on
 * a device that asks for less of it, rows simply come and go.
 */
export function Ranks<T>({ items, keyOf, children, empty, className, ...rest }: {
  items: readonly T[];
  keyOf: (item: T) => string;
  children: (item: T) => ReactNode;
  empty?: ReactNode;
} & Omit<HTMLAttributes<HTMLUListElement>, "children">) {
  const still = useReducedMotion();
  const [held, setHeld] = useState<Held<T>[]>(() => items.map((item) => ({ key: keyOf(item), item, leaving: false, fresh: false })));
  const shown = merge(held, items, keyOf, still);
  // Adjusted during render, not in an effect: a row that has left is marked in the same paint the list changed in.
  if (mark(shown) !== mark(held)) setHeld(shown);

  const leaving = shown.filter((h) => h.leaving).map((h) => h.key).join("\n");
  useEffect(() => {
    if (!leaving) return;
    const gone = new Set(leaving.split("\n"));
    const t = window.setTimeout(() => setHeld((h) => h.filter((x) => !(x.leaving && gone.has(x.key)))), LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);

  return (
    <ul {...rest} className={className ? `ranks ${className}` : "ranks"}>
      {shown.map((h) => (
        <li key={h.key} className="ranks-item" data-leaving={h.leaving || undefined} data-fresh={h.fresh || undefined} inert={h.leaving || undefined} aria-hidden={h.leaving || undefined}>
          <div className="ranks-in">{children(h.item)}</div>
        </li>
      ))}
      {shown.length === 0 && empty ? <li className="ranks-empty rise-in">{empty}</li> : null}
    </ul>
  );
}
