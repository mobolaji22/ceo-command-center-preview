"use client";

import { useQuery } from "@tanstack/react-query";
import { useDataSource } from "@/lib/data";
import type { AgencyBrandView } from "@/lib/model";

/**
 * The agency's brand (v4 ADR-0093), from the data source: one request shared by every screen, read again only when the page reloads.
 * `name` is empty until it arrives, so a screen shows nothing rather than a name typed here; no screen writes the brand itself, and
 * `npm run lint` fails if one does (scripts/check-brand-strings.mjs).
 */
export function useAgencyBrand(): { brand: AgencyBrandView | undefined; name: string; markUrl: string | null; loading: boolean } {
  const ds = useDataSource();
  const q = useQuery({ queryKey: ["agency-brand"], queryFn: () => ds.queries.agencyBrand(), staleTime: Infinity, meta: { static: true } });
  const mark = q.data?.mark ?? null;
  return { brand: q.data, name: q.data?.name ?? "", markUrl: mark ? ds.queries.agencyMarkUrl(mark) : null, loading: q.isPending };
}
