"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDataSource } from "@/lib/data";
import type { AgencyBrandView } from "@/lib/model";

/**
 * The agency's brand (v4 ADR-0093), from the data source: one request shared by every screen, read again only when the page reloads.
 * `name` is empty until it arrives, so a screen shows nothing rather than a name typed here; no screen writes the brand itself, and
 * `npm run lint` fails if one does (scripts/check-brand-strings.mjs). The server draws the page before the brand is read, so the
 * browser's first drawing matches it and the brand appears once mounted, whatever the cache already holds.
 */
export function useAgencyBrand(): { brand: AgencyBrandView | undefined; name: string; markUrl: string | null; loading: boolean } {
  const ds = useDataSource();
  const q = useQuery({ queryKey: ["agency-brand"], queryFn: () => ds.queries.agencyBrand(), staleTime: Infinity, meta: { static: true } });
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const data = mounted ? q.data : undefined;
  const mark = data?.mark ?? null;
  return { brand: data, name: data?.name ?? "", markUrl: mark ? ds.queries.agencyMarkUrl(mark) : null, loading: !mounted || q.isPending };
}

const noSubscribe = () => () => {};
