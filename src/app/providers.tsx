"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { DataSourceProvider } from "@/lib/data";
import { DemoBanner } from "@/components/demo-banner";
import { applyLighting } from "@/lib/lighting";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  // Bring a stored "day" onto <html> after hydration; night is the server render, so nothing mismatches.
  useEffect(() => {
    try { applyLighting(localStorage.getItem("cc-lighting") === "day" ? "day" : "night"); } catch { applyLighting("night"); }
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider>
        {children}
        <DemoBanner />
      </DataSourceProvider>
    </QueryClientProvider>
  );
}
