"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { DataSourceProvider } from "@/lib/data";
import { DemoBanner } from "@/components/demo-banner";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider>
        {children}
        <DemoBanner />
      </DataSourceProvider>
    </QueryClientProvider>
  );
}
