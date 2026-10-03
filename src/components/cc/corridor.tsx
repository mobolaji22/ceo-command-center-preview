"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Fingerprint, LayoutGrid, MoreHorizontal, Search, Compass, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OwnerData } from "@/lib/model";
import { label, statusTone, pad, fmtDate } from "@/lib/format";
import { Empty } from "./views";

const ICONS = [LayoutGrid, Activity, Fingerprint, BookOpen, Search, Compass, Layers];
const CLOSED = ["COMPLETED", "CANCELLED", "ARCHIVED"];

export function departments(data: OwnerData) {
  const set = new Set<string>();
  data.projects.forEach((p) => p.domains.forEach((d) => d.trim() && set.add(d.trim())));
  data.tasks.forEach((t) => t.domain && t.domain !== "general" && set.add(t.domain));
  return [...set].sort((a, b) => a.localeCompare(b));
}

const projectsIn = (data: OwnerData, dept: string) =>
  data.projects.filter((p) => p.domains.includes(dept) || data.tasks.some((t) => t.project_id === p.id && t.domain === dept));

export function HallwayView({ data, enter, openManage }: { data: OwnerData; enter: (dept: string) => void; openManage: () => void }) {
  const depts = departments(data);
  return <div className="hallway-wrap"><div className="eyebrow gold">BEYOND THE OFFICE / ORGANIZATIONAL SPACES</div><h2>The corridor<span className="period">.</span></h2><p className="hallway-subtitle">Every room is a department you work in. Step inside.</p>
    {depts.length === 0 ? <Empty title="No departments yet.">Departments come from the areas you give your projects. <Button variant="ghost" className="inline-arrow" onClick={openManage}>ADD A PROJECT <ArrowRight size={14} /></Button></Empty> :
    <div className="door-grid">{depts.map((d, i) => {
      const Icon = ICONS[i % ICONS.length]!;
      const active = projectsIn(data, d).filter((p) => !CLOSED.includes(p.status)).length;
      return <Button key={d} variant="ghost" className={`door-card ${active ? "" : "unfitted"}`} onClick={() => enter(d)}><span className="door-number">{pad(i + 1)} <MoreHorizontal size={18} /></span><span className="door-icon"><Icon size={28} strokeWidth={1.3} /></span><span className="door-bottom"><span className="door-name">{d}</span><span className={`pill ${active ? "green" : "muted"}`}>{active ? `● ${active} ACTIVE` : "QUIET"}</span></span><span className="door-enter">ENTER ROOM <ArrowRight size={15} /></span></Button>;
    })}</div>}</div>;
}

type Entry = { date: string; text: string; kind: string };

export function RoomView({ data, dept, back, openManage }: { data: OwnerData; dept: string; back: () => void; openManage: (projectId?: string) => void }) {
  const depts = departments(data);
  const projects = projectsIn(data, dept);
  const pages = useMemo(() => {
    const ids = new Set(projects.map((p) => p.id));
    const entries: Entry[] = [];
    data.tasks.filter((t) => t.domain === dept || ids.has(t.project_id)).forEach((t) => {
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
    <div className="room-number">ROOM / {pad(depts.indexOf(dept) + 1)}</div><div className="eyebrow gold">DEPARTMENT</div><h2>{dept}<span className="period">.</span></h2>
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
