"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createApiDataSource } from "./api";
import { createFixturesDataSource } from "./fixtures";
import type { DataSource } from "./types";

/**
 * Picks the DataSource. `fixtures` is the default in development; a production build refuses to
 * start with fixtures unless NEXT_PUBLIC_ALLOW_FIXTURES=true (so demo data can never be mistaken
 * for the real system).
 */
function select(): DataSource {
  const wanted = process.env["NEXT_PUBLIC_DATA_SOURCE"] ?? "fixtures";
  if (wanted === "api") return createApiDataSource();
  if (process.env.NODE_ENV === "production" && process.env["NEXT_PUBLIC_ALLOW_FIXTURES"] !== "true") {
    throw new Error("Fixtures are disabled in production. Set NEXT_PUBLIC_DATA_SOURCE=api (or NEXT_PUBLIC_ALLOW_FIXTURES=true for a demo deployment).");
  }
  return createFixturesDataSource();
}

const Ctx = createContext<DataSource | null>(null);

export function DataSourceProvider({ children }: { children: ReactNode }) {
  // Created once for the life of the app: a lazy state initialiser runs exactly once, where useMemo may re-run.
  const [ds] = useState(select);
  return <Ctx.Provider value={ds}>{children}</Ctx.Provider>;
}

export function useDataSource(): DataSource {
  const ds = useContext(Ctx);
  if (!ds) throw new Error("useDataSource must be used inside <DataSourceProvider>.");
  return ds;
}

export type { DataSource } from "./types";
