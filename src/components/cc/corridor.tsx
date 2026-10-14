"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Activity, ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Fingerprint, LayoutGrid, MoreHorizontal, Search, Compass, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OwnerData } from "@/lib/model";
import { label, statusTone, pad, fmtDate } from "@/lib/format";
import { useReducedMotion } from "@/lib/motion";
import { Hall, type HallDoor } from "./hall";
import { LitImage } from "./lit-image";
import { roomArt } from "./room-art";
import { useDomains, type DomainList } from "@/lib/domains";

const ICONS = [LayoutGrid, Activity, Fingerprint, BookOpen, Search, Compass, Layers];
const CLOSED = ["COMPLETED", "CANCELLED", "ARCHIVED"];

/**
 * The departments are the domains the agency works in, as the API serves them (ADR-0017), not whatever words projects happen to
 * carry. They are always there, in the same order, so a room is where it was yesterday; a room with nothing in it is quiet.
 * Anything a project carries that is not one of them (older records) goes to an "Other" room, which exists only when it has to.
 */
const OTHER = "OTHER";
const norm = (d: string) => d.trim().toUpperCase().replace(/[\s-]+/g, "_");
const isIn = (domain: string, code: string, list: DomainList) =>
  code === OTHER ? domain.trim() !== "" && norm(domain) !== "GENERAL" && !list.some((d) => d.code === norm(domain)) : norm(domain) === code;

export function departments(data: OwnerData, list: DomainList): string[] {
  const codes = list.map((d) => d.code);
  const unknown = data.projects.some((p) => p.domains.some((d) => isIn(d, OTHER, list))) || data.tasks.some((t) => isIn(t.domain ?? "", OTHER, list));
  return unknown ? [...codes, OTHER] : codes;
}

export const taskIn = (t: { domain?: string | null }, dept: string, list: DomainList) => isIn(t.domain ?? "", dept, list);
export const projectsIn = (data: OwnerData, dept: string, list: DomainList) =>
  data.projects.filter((p) => p.domains.some((d) => isIn(d, dept, list)) || data.tasks.some((t) => t.project_id === p.id && taskIn(t, dept, list)));

export function HallwayView({ data, enter, openManage, startAt }: { data: OwnerData; enter: (dept: string) => void; openManage: () => void; startAt?: string | undefined }) {
  const { list, loading, nameOf } = useDomains();
  const doors: HallDoor[] = departments(data, list).map((d, i) => ({
    code: d,
    name: nameOf(d),
    wing: list.find((x) => x.code === d)?.department.name,
    icon: ICONS[i % ICONS.length]!,
    active: projectsIn(data, d, list).filter((p) => !CLOSED.includes(p.status)).length,
  }));
  return <div className="hallway-wrap hall-wrap"><div className="eyebrow gold">BEYOND THE OFFICE / ORGANIZATIONAL SPACES</div><h2>The corridor<span className="period">.</span></h2><p className="hallway-subtitle">Every room is a domain of the agency, in five wings. Walk the hall and step inside.</p>
    {loading ? <p className="hallway-subtitle"><span className="pulse-dot" /> Opening the corridor…</p> : <Hall doors={doors} startAt={startAt} onEnter={enter} />}
    <p className="hallway-subtitle">Work reaches a room when a plan names it. <Button variant="ghost" className="inline-arrow" onClick={openManage}>SEE ALL PROJECTS <ArrowRight size={14} /></Button></p></div>;
}

export type Entry = { date: string; text: string; kind: string };
