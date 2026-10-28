"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * What a desk looks like before its records arrive: the outline of a desk (heading, tabs, a few rows) in the place the real one
 * will take, so nothing jumps when the data lands. The desk opens at once, from a link or a key, and fills in; a load that fails
 * says so in the same place.
 */
export function DeskSkeleton({ error }: { error?: string | undefined }) {
  if (error) return <div className="empty-state"><div><b>Couldn&apos;t load the ledger.</b><p>{error}</p></div></div>;
  return (
    <div className="desk-skeleton" role="status" aria-label="Loading">
      <Skeleton className="sk-eyebrow" />
      <Skeleton className="sk-title" />
      <Skeleton className="sk-line" />
      <div className="sk-tabs">{[0, 1, 2].map((i) => <Skeleton key={i} className="sk-tab" />)}</div>
      {[0, 1, 2, 3].map((i) => <div key={i} className="sk-row"><Skeleton className="sk-index" /><div><Skeleton className="sk-name" /><Skeleton className="sk-meta" /></div><Skeleton className="sk-pill" /></div>)}
    </div>
  );
}

/** The corridor before it has arrived: the outline of its doors. */
export function DoorsSkeleton() {
  return <div className="desk-skeleton doors-skeleton" role="status" aria-label="Loading"><Skeleton className="sk-title" /><div className="sk-doors">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="sk-door" />)}</div></div>;
}
