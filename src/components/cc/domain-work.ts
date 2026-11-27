import type { OwnerData } from "@/lib/model";
import type { DomainList } from "@/lib/domains";

/**
 * Which work sits in which domain, for the room screens that still read the owner's records (until each room reads v4's RoomView,
 * slice 4.3). The domains are the agency's, as the API serves them (ADR-0017), not whatever words projects happen to carry; they keep
 * one order, so a room is where it was yesterday.
 * Anything a project carries that is not one of them (older records) goes to an "Other" room, which exists only when it has to.
 */
const OTHER = "OTHER";
const norm = (d: string) => d.trim().toUpperCase().replace(/[\s-]+/g, "_");
const isIn = (domain: string, code: string, list: DomainList) =>
  code === OTHER ? domain.trim() !== "" && norm(domain) !== "GENERAL" && !list.some((d) => d.code === norm(domain)) : norm(domain) === code;

export function domainOrder(data: OwnerData, list: DomainList): string[] {
  const codes = list.map((d) => d.code);
  const unknown = data.projects.some((p) => p.domains.some((d) => isIn(d, OTHER, list))) || data.tasks.some((t) => isIn(t.domain ?? "", OTHER, list));
  return unknown ? [...codes, OTHER] : codes;
}

export const taskIn = (t: { domain?: string | null }, dept: string, list: DomainList) => isIn(t.domain ?? "", dept, list);
export const projectsIn = (data: OwnerData, dept: string, list: DomainList) =>
  data.projects.filter((p) => p.domains.some((d) => isIn(d, dept, list)) || data.tasks.some((t) => t.project_id === p.id && taskIn(t, dept, list)));

export type Entry = { date: string; text: string; kind: string };
