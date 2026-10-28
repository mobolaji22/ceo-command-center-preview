"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useDataSource } from "@/lib/data";

const never = () => () => {};

/**
 * Shown whenever the fixtures DataSource is active, so demo data is never mistaken for real data. Bottom centre on a wide screen; in
 * the bar on a phone (phone.css), so it never covers content. On the monitor, and inside its frames, it is left out: the monitor's
 * own bar already says the data is demo data, and the badges there covered the desks' buttons.
 */
export function DemoBanner() {
  const ds = useDataSource();
  const framed = useSyncExternalStore(never, () => window.self !== window.top, () => false);
  const monitor = usePathname() === "/monitor";
  if (ds.kind !== "fixtures" || framed || monitor) return null;
  return (
    <div role="status" className="demo-banner">
      DEMO DATA · FIXTURES
    </div>
  );
}
