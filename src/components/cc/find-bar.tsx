"use client";

import { Search, X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { queryWords, type FindOption, type Sort } from "@/lib/find";

type Shape = {
  q: string; setQ: (q: string) => void;
  status: string; setStatus: (s: string) => void;
  dept: string; setDept: (d: string) => void;
  sort: Sort; setSort: (s: Sort) => void;
  statusOptions: FindOption[]; deptOptions: FindOption[];
  filtering: boolean; clear: () => void; total: number;
};

/**
 * Search and filters for a list of projects. Typing filters as you go, so there is no Search button to press: Enter settles on the
 * results, and when exactly one project is left an Open button appears (Enter does the same). Chips only appear when there is
 * something to choose between. The count is spoken politely so a screen reader hears the list change without being moved.
 */
export function FindBar({ find, shown, noun = "projects", showDept, showSort, extra, onOnly }: { find: Shape; shown: number; noun?: string; showDept?: boolean; showSort?: boolean; extra?: ReactNode; /** Called when Enter or Open is pressed and exactly one result is left. */ onOnly?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  if (find.total === 0) return null;
  return (
    <form role="search" aria-label={`Find in ${noun}`} className="find-bar" onSubmit={(e) => { e.preventDefault(); if (shown === 1 && onOnly) onOnly(); else input.current?.blur(); }}>
      <div className="find-row">
        <label className="find-field">
          <Search size={15} aria-hidden="true" />
          <input ref={input} type="search" value={find.q} placeholder={`Search ${noun}`} aria-label={`Search ${noun}`} autoComplete="off" spellCheck={false} onChange={(e) => find.setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape" && find.q) { e.stopPropagation(); find.setQ(""); } }} />
          {find.q && <button type="button" className="find-clear" aria-label="Clear search" onClick={() => { find.setQ(""); input.current?.focus(); }}><X size={13} /></button>}
        </label>
        {onOnly && shown === 1 && find.filtering && <Button type="submit" variant="ghost" className="find-go">Open</Button>}
        {showDept && find.deptOptions.length > 2 && (
          <select className="find-select" aria-label="Department" value={find.dept} onChange={(e) => find.setDept(e.target.value)}>
            {find.deptOptions.map((o) => <option key={o.id} value={o.id}>{o.label}{o.id === "ALL" ? "" : ` (${o.count})`}</option>)}
          </select>
        )}
        {showSort && find.total > 3 && (
          <select className="find-select" aria-label="Sort" value={find.sort} onChange={(e) => find.setSort(e.target.value as Sort)}>
            <option value="new">Newest first</option><option value="old">Oldest first</option><option value="az">A to Z</option>
          </select>
        )}
        {extra}
      </div>
      {find.statusOptions.length > 2 && (
        <div className="find-chips" role="group" aria-label="Filter by status">
          {find.statusOptions.map((o) => <button key={o.id} type="button" className="find-chip" aria-pressed={find.status === o.id} onClick={() => find.setStatus(o.id)}>{o.label}<em aria-hidden="true">{o.count}</em></button>)}
        </div>
      )}
      <p className="find-count" aria-live="polite">
        {find.filtering ? `${shown} of ${find.total} ${noun}` : `${find.total} ${noun}`}
        {find.filtering && <button type="button" className="find-reset" onClick={find.clear}>Clear filters</button>}
      </p>
    </form>
  );
}

/** Wraps the words that were searched for in <mark>, so you can see why a result matched. Plain text when nothing is searched. */
export function Marked({ text, q }: { text: string; q: string }) {
  const words = queryWords(q);
  if (!words.length) return <>{text}</>;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig");
  return <>{text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part))}</>;
}

/**
 * The same bar for lists that are not projects (a calendar's entries, a desk's tasks, a client's timeline): words to find, and
 * chips to narrow by one thing. Everything on screen is filtered as you type; Enter just settles the focus.
 */
export function TextFind({ noun, q, setQ, chips, value, onValue, shown, total, chipsLabel }: { noun: string; q: string; setQ: (q: string) => void; chips?: FindOption[]; value?: string; onValue?: (v: string) => void; shown: number; total: number; chipsLabel?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const filtering = q.trim() !== "" || (value !== undefined && value !== "ALL");
  if (total === 0) return null;
  return (
    <form role="search" aria-label={`Find in ${noun}`} className="find-bar" onSubmit={(e) => { e.preventDefault(); input.current?.blur(); }}>
      <div className="find-row">
        <label className="find-field">
          <Search size={15} aria-hidden="true" />
          <input ref={input} type="search" value={q} placeholder={`Search ${noun}`} aria-label={`Search ${noun}`} autoComplete="off" spellCheck={false} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape" && q) { e.stopPropagation(); setQ(""); } }} />
          {q && <button type="button" className="find-clear" aria-label="Clear search" onClick={() => { setQ(""); input.current?.focus(); }}><X size={13} /></button>}
        </label>
      </div>
      {chips && chips.length > 2 && onValue && (
        <div className="find-chips" role="group" aria-label={chipsLabel ?? "Filter"}>
          {chips.map((o) => <button key={o.id} type="button" className="find-chip" aria-pressed={value === o.id} onClick={() => onValue(o.id)}>{o.label}<em aria-hidden="true">{o.count}</em></button>)}
        </div>
      )}
      <p className="find-count" aria-live="polite">
        {filtering ? `${shown} of ${total} ${noun}` : `${total} ${noun}`}
        {filtering && <button type="button" className="find-reset" onClick={() => { setQ(""); onValue?.("ALL"); }}>Clear filters</button>}
      </p>
    </form>
  );
}
