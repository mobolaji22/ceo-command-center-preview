"use client";

import { useQuery } from "@tanstack/react-query";
import { useDataSource } from "@/lib/data";
import type { DomainView } from "@/lib/model";

export type DomainList = readonly Pick<DomainView, "code" | "name" | "department">[];

/** A code as words, for the moment before the list arrives ("SOCIAL_GROWTH" → "Social growth"). Never a second list of names. */
export const humanize = (code: string) => code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, " ");

/**
 * The domains the agency works in (the rooms), from the API: one request shared by every component, read again only when the
 * page reloads. `nameOf` answers before the list has arrived, so a label never flashes empty.
 */
export function useDomains(): { list: DomainList; loading: boolean; nameOf: (code: string) => string } {
  const ds = useDataSource();
  const q = useQuery({ queryKey: ["domains"], queryFn: () => ds.queries.domains(), staleTime: Infinity, meta: { static: true } });
  const list = q.data ?? [];
  return { list, loading: q.isPending, nameOf: (code) => list.find((d) => d.code === code)?.name ?? humanize(code) };
}
