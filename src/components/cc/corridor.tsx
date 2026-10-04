"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Fingerprint, LayoutGrid, MoreHorizontal, Search, Compass, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OwnerData } from "@/lib/model";
import { label, statusTone, pad, fmtDate } from "@/lib/format";

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

const taskIn = (t: { domain?: string | null }, dept: string) => isIn(t.domain ?? "", dept);
const projectsIn = (data: OwnerData, dept: string) =>
  data.projects.filter((p) => p.domains.some((d) => isIn(d, dept)) || data.tasks.some((t) => t.project_id === p.id && taskIn(t, dept)));

export function HallwayView({ data, enter, openManage }: { data: OwnerData; enter: (dept: string) => void; openManage: () => void }) {
  const depts = departments(data);
  return <div className="hallway-wrap"><div className="eyebrow gold">BEYOND THE OFFICE / ORGANIZATIONAL SPACES</div><h2>The corridor<span className="period">.</span></h2><p className="hallway-subtitle">Every room is a department of the agency. Step inside.</p>
    <div className="door-grid">{depts.map((d, i) => {
      const Icon = ICONS[i % ICONS.length]!;
      const active = projectsIn(data, d).filter((p) => !CLOSED.includes(p.status)).length;
      return <Button key={d} variant="ghost" className={`door-card ${active ? "" : "unfitted"}`} onClick={() => enter(d)}><span className="door-number">{pad(i + 1)} <MoreHorizontal size={18} /></span><span className="door-icon"><Icon size={28} strokeWidth={1.3} /></span><span className="door-bottom"><span className="door-name">{departmentName(d)}</span><span className={`pill ${active ? "green" : "muted"}`}>{active ? `● ${active} ACTIVE` : "QUIET"}</span></span><span className="door-enter">ENTER ROOM <ArrowRight size={15} /></span></Button>;
    })}</div><p className="hallway-subtitle">Work reaches a room when a plan names it. <Button variant="ghost" className="inline-arrow" onClick={openManage}>SEE ALL PROJECTS <ArrowRight size={14} /></Button></p></div>;
}

type Entry = { date: string; text: string; kind: string };

export function RoomView({ data, dept, back, openManage }: { data: OwnerData; dept: string; back: () => void; openManage: (projectId?: string) => void }) {
  const depts = departments(data);
  const projects = projectsIn(data, dept);
  const mine = data.tasks.filter((t) => taskIn(t, dept));
  const desk = { moving: mine.filter((t) => t.status === "RUNNING" || t.status === "READY").length, waiting: mine.filter((t) => ["WAITING", "BLOCKED", "FAILED"].includes(t.status)).length, done: mine.filter((t) => t.status === "COMPLETED").length };
  const pages = useMemo(() => {
    const ids = new Set(projects.map((p) => p.id));
    const entries: Entry[] = [];
    data.tasks.filter((t) => taskIn(t, dept) || ids.has(t.project_id)).forEach((t) => {
      if (t.completed_at) entries.push({ date: t.completed_at, text: `Completed · ${t.title}`, kind: "done" });
      if (t.started_at) entries.push({ date: t.started_at, text: `Started · ${t.title}`, kind: "start" });
      entries.push({ date: t.created_at, text: `Tasked · ${t.title}`, kind: "task" });
    });
    projects.forEach((p) => {
      entries.push({ date: p.created_at, text: `Project opened · ${p.name}`, kind: "project" });
      if (p.completed_at) entries.push({ date: p.completed_at, text: `Project completed · ${p.name}`, kind: "done" });
    });
    const byMonth = new Map<string, Entry[]>();
    entries.sort((a, b) => b.date.localeCompare(a.date)).forEach((e) => {
      const k = e.date.slice(0, 7);
      byMonth.set(k, [...(byMonth.get(k) ?? []), e]);
    });
    return [...byMonth.entries()];
  }, [data, dept, projects]);
  const [page, setPage] = useState(0);
  const [flip, setFlip] = useState(0);
  const go = (n: number) => { setPage(n); setFlip((f) => f + 1); };
  const current = pages[page];
  const monthName = current ? new Date(current[0] + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "";

  return <div className="room-wrap room-full"><Button variant="ghost" className="back-link" onClick={back}><ArrowLeft size={16} /> ALL ROOMS</Button>
    <div className="room-number">ROOM / {pad(depts.indexOf(dept) + 1)}</div><div className="eyebrow gold">DEPARTMENT</div><h2>{departmentName(dept)}<span className="period">.</span></h2>
    <p className="hallway-subtitle" aria-label="On the desks">{desk.moving} in motion · {desk.waiting} waiting · {desk.done} done in this department.</p>
    <div className="room-walls">
      <section className="room-wall"><div className="section-label"><span>PINNED TO THE WALL</span><span>{pad(projects.length)} PROJECTS</span></div>
        {projects.length === 0 ? <div className="wall-empty">No projects pinned on the walls.</div> :
        <div className="pin-board">{projects.map((p, i) => <button key={p.id} className="pin-card" style={{ ["--tilt" as string]: `${(i % 3) - 1}deg` }} onClick={() => openManage(p.id)}><span className="pin" /><b>{p.name}</b><small>{p.description || "No description"}</small><span className={`pill ${statusTone(p.status)}`}>{label(p.status).toUpperCase()}</span><em>Opened {fmtDate(p.created_at)}</em></button>)}</div>}
      </section>
      <section className="room-wall"><div className="section-label"><span>WORK CALENDAR</span><span>{pages.length ? `PAGE ${page + 1} / ${pages.length}` : "EMPTY"}</span></div>
        <div className="flipbook">
          <div className="flipbook-rings">{Array.from({ length: 8 }).map((_, i) => <i key={i} />)}</div>
          {current ? <div key={flip} className="flip-page">
            <div className="flip-month">{monthName}</div>
            <ul>{current[1].map((e, i) => <li key={i} className={`flip-${e.kind}`}><span>{new Date(e.date).getDate()}</span>{e.text}</li>)}</ul>
          </div> : <div className="flip-page"><div className="flip-month">No history yet</div><p className="wall-empty">Dates appear here as work is tasked, started, and completed in this department.</p></div>}
          <div className="flip-controls"><Button variant="ghost" size="icon" aria-label="Newer month" disabled={page === 0} onClick={() => go(page - 1)}><ChevronLeft size={18} /></Button><Button variant="ghost" size="icon" aria-label="Older month" disabled={page >= pages.length - 1} onClick={() => go(page + 1)}><ChevronRight size={18} /></Button></div>
        </div>
      </section>
    </div></div>;
}
