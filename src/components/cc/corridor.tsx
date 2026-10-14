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

const ICONS = [LayoutGrid, Activity, Fingerprint, BookOpen, Search, Compass, Layers];
const CLOSED = ["COMPLETED", "CANCELLED", "ARCHIVED"];

/**
 * The departments are the nine domains the agency actually works in (the same ones plans are written in), not whatever words projects
 * happen to carry. They are always there, in the same order, so a room is where it was yesterday; a room with nothing in it is quiet.
 * Anything a project carries that is not one of the nine (older records) goes to an "Other" room, which exists only when it has to.
 */
export const DEPARTMENTS = [
  { code: "BUSINESS", name: "Business" }, { code: "MARKET", name: "Market" }, { code: "BRAND", name: "Brand" }, { code: "CONTENT", name: "Content" },
  { code: "DESIGN", name: "Design" }, { code: "MARKETING", name: "Marketing" }, { code: "ENGINEERING", name: "Engineering" },
  { code: "STRATEGY", name: "Strategy" }, { code: "SOCIAL_GROWTH", name: "Social Growth" },
] as const;
const KNOWN = new Set<string>(DEPARTMENTS.map((d) => d.code));
const OTHER = "OTHER";
const norm = (d: string) => d.trim().toUpperCase().replace(/[\s-]+/g, "_");
const isIn = (domain: string, code: string) => (code === OTHER ? domain.trim() !== "" && norm(domain) !== "GENERAL" && !KNOWN.has(norm(domain)) : norm(domain) === code);
export const departmentName = (code: string) => DEPARTMENTS.find((d) => d.code === code)?.name ?? "Other";

export function departments(data: OwnerData): string[] {
  const codes: string[] = DEPARTMENTS.map((d) => d.code);
  const unknown = data.projects.some((p) => p.domains.some((d) => isIn(d, OTHER))) || data.tasks.some((t) => isIn(t.domain ?? "", OTHER));
  return unknown ? [...codes, OTHER] : codes;
}

export const taskIn = (t: { domain?: string | null }, dept: string) => isIn(t.domain ?? "", dept);
export const projectsIn = (data: OwnerData, dept: string) =>
  data.projects.filter((p) => p.domains.some((d) => isIn(d, dept)) || data.tasks.some((t) => t.project_id === p.id && taskIn(t, dept)));

export function HallwayView({ data, enter, openManage, startAt }: { data: OwnerData; enter: (dept: string) => void; openManage: () => void; startAt?: string | undefined }) {
  const doors: HallDoor[] = departments(data).map((d, i) => ({
    code: d,
    name: departmentName(d),
    icon: ICONS[i % ICONS.length]!,
    active: projectsIn(data, d).filter((p) => !CLOSED.includes(p.status)).length,
  }));
  return <div className="hallway-wrap hall-wrap"><div className="eyebrow gold">BEYOND THE OFFICE / ORGANIZATIONAL SPACES</div><h2>The corridor<span className="period">.</span></h2><p className="hallway-subtitle">Every room is a department of the agency. Walk the hall and step inside.</p>
    <Hall doors={doors} startAt={startAt} onEnter={enter} />
    <p className="hallway-subtitle">Work reaches a room when a plan names it. <Button variant="ghost" className="inline-arrow" onClick={openManage}>SEE ALL PROJECTS <ArrowRight size={14} /></Button></p></div>;
}

export type Entry = { date: string; text: string; kind: string };
