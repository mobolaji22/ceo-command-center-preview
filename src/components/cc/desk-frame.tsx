"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * The surface a desk is worked on. Each object in a room has the surface that object would have: the wall is a corkboard, the
 * calendar a wall calendar, the desk a wooden desk with a ledger on it, the table a table with folders, the screen a monitor,
 * the lamp a letter under lamplight, the shelf a bookshelf. The layout is the same (heading, tabs, content) so a desk is easy to
 * read wherever it is; only the material changes. Tabs keep information in layers: a desk opens on its first tab, one at a time.
 *
 * Styles live in desks.css by kind. `data-desk` is the stable hook for tests and for the overlay.
 */
export type DeskKind = "cork" | "board" | "calendar" | "desk" | "table" | "screen" | "paper" | "shelf";

export function DeskFrame<T extends string>({ kind, eyebrow, title, line, tabs, tab, onTab, aside, above, children }: { kind: DeskKind; bar?: string; eyebrow: string; title: string; line?: ReactNode; tabs: { id: T; label: string; count?: number }[]; tab: T; onTab: (t: T) => void; aside?: ReactNode; /** Sits on the surface just above the content (the table's folder tabs). */ above?: ReactNode; children: ReactNode }) {
  const tabRow = tabs.length > 1 && (
    <div className="desk-tabs" role="tablist">
      {tabs.map((t) => (
        <Button key={t.id} role="tab" aria-selected={tab === t.id} variant="ghost" className={tab === t.id ? "tab active" : "tab"} onClick={() => onTab(t.id)}>
          {t.label}{t.count ? <span className="tab-count">{t.count}</span> : null}
        </Button>
      ))}
    </div>
  );
  const heading = (
    <header className="desk-heading">
      <div><div className="eyebrow gold">{eyebrow}</div><h2>{title}<span className="period">.</span></h2>{line ? <p>{line}</p> : null}</div>
      {aside}
    </header>
  );
  return (
    <section className={`desk-surface surface-${kind}`} data-desk={kind}>
      <span className="surface-deco surface-deco-a" aria-hidden="true" />
      <span className="surface-deco surface-deco-b" aria-hidden="true" />
      {kind === "desk" ? (
        <div className="ledger-book">
          <div className="ledger-left">{heading}{tabRow}</div>
          <div className="ledger-right desk-content">{children}</div>
        </div>
      ) : (
        <>
          {heading}
          {tabRow}
          <div className="desk-content">{above}{kind === "table" || kind === "board" ? <div className="desk-sheet">{children}</div> : children}</div>
        </>
      )}
    </section>
  );
}
