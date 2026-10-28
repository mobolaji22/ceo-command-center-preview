"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { DataSourceProvider, useDataSource } from "@/lib/data";
import { isFixturesChange } from "@/lib/data/fixtures";
import { DemoBanner } from "@/components/demo-banner";
import { applyLighting } from "@/lib/lighting";

/**
 * How often what is on screen is read again while the tab is visible ("LIVE LEDGER"). The API has no stream yet, so every screen
 * asks again on this beat; a hidden tab asks nothing. When v4 offers a stream (docs/INTEGRATION.md, "Live updates") this becomes
 * the fallback for when the stream drops, not the main way news arrives. A query marked `meta: { static: true }` (the domain list,
 * which changes only with a release) is never polled.
 */
export const LIVE_MS = 20_000;

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchInterval: (q) => (q.meta?.["static"] ? false : LIVE_MS), refetchIntervalInBackground: false } } }));
  // Bring a stored "day" onto <html> after hydration; night is the server render, so nothing mismatches.
  useEffect(() => {
    try { applyLighting(localStorage.getItem("cc-lighting") === "day" ? "day" : "night"); } catch { applyLighting("night"); }
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider>
        {children}
        <DemoBanner />
        <DemoLiveRefresh />
      </DataSourceProvider>
    </QueryClientProvider>
  );
}

/**
 * Demo only: when the demo's records change in another tab or in the monitor's other frame, read again, so the CEO's office and a
 * client's room show each other's changes as they happen. The real API has no such channel yet; each screen reads on its own.
 */
function DemoLiveRefresh() {
  const ds = useDataSource();
  const qc = useQueryClient();
  useEffect(() => {
    if (ds.kind !== "fixtures") return;
    const onStorage = (e: StorageEvent) => { if (isFixturesChange(e)) void qc.invalidateQueries(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [ds, qc]);
  return null;
}
