"use client";

import { useDataSource } from "@/lib/data";

/** Shown whenever the fixtures DataSource is active, so demo data is never mistaken for real data. Bottom centre, so it never sits on a room's own status line. */
export function DemoBanner() {
  const ds = useDataSource();
  if (ds.kind !== "fixtures") return null;
  return (
    <div
      role="status"
      style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 8, pointerEvents: "none", zIndex: 50, padding: "6px 10px", fontSize: 9, letterSpacing: ".14em", fontWeight: 700, color: "var(--primary)", background: "oklch(0.18 0.006 270 / 92%)", border: "1px solid oklch(0.76 0.146 76 / 30%)", borderRadius: 2 }}
    >
      DEMO DATA · FIXTURES
    </div>
  );
}
