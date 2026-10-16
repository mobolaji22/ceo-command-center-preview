"use client";

import { useDataSource } from "@/lib/data";

/** Shown whenever the fixtures DataSource is active, so demo data is never mistaken for real data. Bottom centre on a wide screen; in the bar on a phone (phone.css), so it never covers content. */
export function DemoBanner() {
  const ds = useDataSource();
  if (ds.kind !== "fixtures") return null;
  return (
    <div role="status" className="demo-banner">
      DEMO DATA · FIXTURES
    </div>
  );
}
