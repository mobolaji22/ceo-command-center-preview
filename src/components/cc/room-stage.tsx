"use client";

import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, DoorOpen, ListChecks, PanelTop, PenTool } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { fmtDate, label, pad, statusTone } from "@/lib/format";
import type { OwnerData } from "@/lib/model";
import { departments, projectsIn, taskIn, type Entry } from "./corridor";
import { useDomains, type DomainList } from "@/lib/domains";
import { DeskFrame } from "./desk-frame";
import { OfficeStage, type Spot } from "./office-stage";
import { CORRIDOR_ART, roomArt } from "./room-art";
import { Empty } from "./views";
import { WorkshopDesk } from "./workshop/workshop";
import { FindBar, Marked, TextFind } from "./find-bar";
import { useProjectFind, type FindOption } from "@/lib/find";

/**
 * A department is a room you stand in, like the CEO's office: its own photograph, three objects to press, and a desk behind each.
 * The wall holds the projects pinned to the department, the calendar its dated history, the desk the work in motion, waiting and
 * done. Where the objects sit is in the stylesheet by room (.room-<dept> .hotspot-<spot>) because every room's photograph differs.
 */
export type RoomSpot = "wall" | "calendar" | "desk" | "workshop";

const spotData: Record<RoomSpot, Omit<Spot<RoomSpot>, "id">> = {
  wall: { title: "PINNED TO THE WALL", label: "Wall", description: "The projects pinned to this department.", action: "Open pinned projects", icon: PanelTop },
  calendar: { title: "WORK CALENDAR", label: "Calendar", description: "What was tasked, started and finished here, month by month.", action: "Open work calendar", icon: CalendarDays },
  workshop: { title: "DESIGN WORKSHOP", label: "Workshop", description: "Adjust the direction that was chosen: tokens, type, layout, copy and notes, with every change recorded.", action: "Open the workshop", icon: PenTool },
  desk: { title: "ON THE DESKS", label: "Desk", description: "Work in motion, work waiting, and work done in this room.", action: "Open the desks", icon: ListChecks },
};
const SPOTS: RoomSpot[] = ["wall", "calendar", "desk"];
/** The Design room has a fourth object: the monitors, where the design is worked on. */
const spotsFor = (dept: string): RoomSpot[] => (dept === "DESIGN" ? [...SPOTS, "workshop"] : SPOTS);

const tasksOf = (data: OwnerData, dept: string, list: DomainList) => data.tasks.filter((t) => taskIn(t, dept, list));
const counts = (data: OwnerData, dept: string, list: DomainList) => {
  const mine = tasksOf(data, dept, list);
  return {
    moving: mine.filter((t) => t.status === "RUNNING" || t.status === "READY").length,
    waiting: mine.filter((t) => ["WAITING", "BLOCKED", "FAILED"].includes(t.status)).length,
    done: mine.filter((t) => t.status === "COMPLETED").length,
  };
};

export function RoomStage({ data, dept, back, toOffice, goTo, onAct }: { data: OwnerData; dept: string; back: () => void; toOffice: () => void; goTo?: ((dept: string) => void) | undefined; onAct: (spot: RoomSpot, at: { x: number; y: number }) => void }) {
  const { list, nameOf } = useDomains();
  const depts = departments(data, list);
  const projects = projectsIn(data, dept, list);
  const desk = counts(data, dept, list);
  const art = roomArt(dept) ?? CORRIDOR_ART;
  const name = nameOf(dept);
  return (
    <OfficeStage
      className={`room-stage room-${dept.toLowerCase()}`}
      art={art}
      alt=""
      eyebrow={`${(list.find((d) => d.code === dept)?.department.name ?? "Other").toUpperCase()} / ROOM ${pad(depts.indexOf(dept) + 1)}`}
      heading={name}
      line={<><span aria-label="On the desks">{desk.moving} in motion · {desk.waiting} waiting · {desk.done} done in this room.</span>{projects.length === 0 && <span className="wall-empty stage-note">No projects pinned on the walls.</span>}</>}
      sideLabel={[`ROOM / ${pad(depts.indexOf(dept) + 1)}`, name.toUpperCase()]}
      spots={spotsFor(dept).map((id) => ({ id, ...spotData[id], count: id === "desk" ? desk.waiting : 0, countNote: id === "desk" ? `${desk.waiting} waiting` : "" }))}
      statusList={dept === "DESIGN" ? "Wall · Calendar · Desk · Workshop" : "Wall · Calendar · Desk"}
      coordinate={<>40° 43′ N &nbsp; / &nbsp; 73° 59′ W</>}
      nav={<>
        <div className="stage-nav-links">
          <Button variant="ghost" className="back-link" onClick={back}><ArrowLeft size={16} /> ALL ROOMS</Button>
          <Button variant="ghost" className="back-link" aria-label="BACK TO OFFICE" onClick={toOffice}><DoorOpen size={16} /> OFFICE</Button>
        </div>
        <nav className="room-rail" aria-label="Move to another room">{depts.map((d, i) => <button key={d} type="button" className="rail-door" aria-label={`Go to ${nameOf(d)}`} aria-current={d === dept ? "page" : undefined} title={nameOf(d)} disabled={!goTo} onClick={() => goTo?.(d)}>{pad(i + 1)}</button>)}</nav>
      </>}
      onAct={onAct}
    />
  );
}

const projectName = (data: OwnerData, pid: string | null | undefined) => data.projects.find((p) => p.id === pid)?.name ?? "";

export function RoomDesk({ data, dept, spot, openManage }: { data: OwnerData; dept: string; spot: RoomSpot; openManage: (projectId?: string) => void }) {
  if (spot === "workshop") return <WorkshopDesk data={data} dept={dept} />;
  if (spot === "wall") return <WallDesk data={data} dept={dept} openManage={openManage} />;
  if (spot === "calendar") return <CalendarDesk data={data} dept={dept} />;
  return <TasksDesk data={data} dept={dept} />;
}

function WallDesk({ data, dept, openManage }: { data: OwnerData; dept: string; openManage: (projectId?: string) => void }) {
  const { list, nameOf } = useDomains();
  const projects = projectsIn(data, dept, list);
  const find = useProjectFind(projects, nameOf);
  return (
    <DeskFrame kind="cork" eyebrow="PINNED TO THE WALL" title="Pinned projects" line={`${pad(projects.length)} project${projects.length === 1 ? "" : "s"} in this room.`} tab="all" onTab={() => {}} tabs={[{ id: "all", label: "All" }]}>
      {projects.length > 0 && <FindBar find={find} shown={find.results.length} />}
      {projects.length === 0 ? <div className="wall-empty">No projects pinned on the walls.</div> : find.results.length === 0 ? <div className="wall-empty">No pinned project matches.</div> :
        <div className="pin-board">{find.results.map((p, i) => <button key={p.id} className="pin-card" style={{ ["--tilt" as string]: `${(i % 3) - 1}deg`, ["--i" as string]: i } as CSSProperties} onClick={() => openManage(p.id)}><span className="pin" /><b><Marked text={p.name} q={find.q} /></b><small>{p.description || "No description"}</small><span className={`pill ${statusTone(p.status)}`}>{label(p.status).toUpperCase()}</span><em>Opened {fmtDate(p.created_at)}</em></button>)}</div>}
    </DeskFrame>
  );
}

function CalendarDesk({ data, dept }: { data: OwnerData; dept: string }) {
  const { list } = useDomains();
  const projects = projectsIn(data, dept, list);
  const [kind, setKind] = useState("ALL");
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const pages = useMemo(() => {
    const ids = new Set(projects.map((p) => p.id));
    const entries: Entry[] = [];
    data.tasks.filter((t) => taskIn(t, dept, list) || ids.has(t.project_id)).forEach((t) => {
      if (t.completed_at) entries.push({ date: t.completed_at, text: `Completed · ${t.title}`, kind: "done" });
      if (t.started_at) entries.push({ date: t.started_at, text: `Started · ${t.title}`, kind: "start" });
      entries.push({ date: t.created_at, text: `Tasked · ${t.title}`, kind: "task" });
    });
    projects.forEach((p) => {
      entries.push({ date: p.created_at, text: `Project opened · ${p.name}`, kind: "project" });
      if (p.completed_at) entries.push({ date: p.completed_at, text: `Project completed · ${p.name}`, kind: "done" });
    });
    const byMonth = new Map<string, Entry[]>();
    entries.filter((e) => (kind === "ALL" || e.kind === kind) && (!words.length || words.every((w) => e.text.toLowerCase().includes(w)))).sort((a, b) => b.date.localeCompare(a.date)).forEach((e) => {
      const k = e.date.slice(0, 7);
      byMonth.set(k, [...(byMonth.get(k) ?? []), e]);
    });
    return [...byMonth.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- words is derived from q
  }, [data, dept, list, projects, kind, q]);
  const allEntries = useMemo(() => {
    const ids = new Set(projects.map((p) => p.id));
    const out: Entry[] = [];
    data.tasks.filter((t) => taskIn(t, dept, list) || ids.has(t.project_id)).forEach((t) => { if (t.completed_at) out.push({ date: t.completed_at, text: t.title, kind: "done" }); if (t.started_at) out.push({ date: t.started_at, text: t.title, kind: "start" }); out.push({ date: t.created_at, text: t.title, kind: "task" }); });
    projects.forEach((p) => { out.push({ date: p.created_at, text: p.name, kind: "project" }); if (p.completed_at) out.push({ date: p.completed_at, text: p.name, kind: "done" }); });
    return out;
  }, [data, dept, list, projects]);
  const kindChips: FindOption[] = [{ id: "ALL", label: "All", count: allEntries.length }, ...(["task", "start", "done", "project"] as const).map((k) => ({ id: k, label: { task: "Tasked", start: "Started", done: "Finished", project: "Projects" }[k], count: allEntries.filter((e) => e.kind === k).length })).filter((c) => c.count > 0)];
  const shownCount = pages.reduce((n, [, es]) => n + es.length, 0);
  const [page, setPage] = useState(0);
  const [flip, setFlip] = useState(0);
  const go = (n: number) => { setPage(n); setFlip((f) => f + 1); };
  const safePage = Math.min(page, Math.max(0, pages.length - 1));
  const current = pages[safePage];
  const monthName = current ? new Date(current[0] + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "";
  return (
    <DeskFrame kind="calendar" eyebrow="WORK CALENDAR" title="Work calendar" line={pages.length ? `Page ${safePage + 1} of ${pages.length}.` : "Nothing dated yet."} tab="all" onTab={() => {}} tabs={[{ id: "all", label: "All" }]}>
      <TextFind noun="entries" q={q} setQ={(v) => { setQ(v); setPage(0); }} chips={kindChips} value={kind} onValue={(v) => { setKind(v); setPage(0); }} chipsLabel="Filter by what happened" shown={shownCount} total={allEntries.length} />
      <div className="flipbook">
        <div className="flipbook-rings">{Array.from({ length: 8 }).map((_, i) => <i key={i} />)}</div>
        {current ? <div key={flip} className="flip-page">
          <div className="flip-month">{monthName}</div>
          <ul>{current[1].map((e, i) => <li key={i} className={`flip-${e.kind}`}><span>{new Date(e.date).getDate()}</span>{e.text}</li>)}</ul>
        </div> : <div className="flip-page"><div className="flip-month">{allEntries.length ? "Nothing matches" : "No history yet"}</div><p className="wall-empty">{allEntries.length ? "Try another word or clear the filters." : "Dates appear here as work is tasked, started, and completed in this room."}</p></div>}
        <div className="flip-controls"><Button variant="ghost" size="icon" aria-label="Newer month" disabled={safePage === 0} onClick={() => go(safePage - 1)}><ChevronLeft size={18} /></Button><Button variant="ghost" size="icon" aria-label="Older month" disabled={safePage >= pages.length - 1} onClick={() => go(safePage + 1)}><ChevronRight size={18} /></Button></div>
      </div>
    </DeskFrame>
  );
}

function TasksDesk({ data, dept }: { data: OwnerData; dept: string }) {
  const { list } = useDomains();
  const mine = tasksOf(data, dept, list);
  const groups = {
    moving: mine.filter((t) => t.status === "RUNNING" || t.status === "READY"),
    waiting: mine.filter((t) => ["WAITING", "BLOCKED", "FAILED"].includes(t.status)),
    done: mine.filter((t) => t.status === "COMPLETED"),
  };
  const [tab, setTab] = useState<"moving" | "waiting" | "done">(groups.moving.length || !groups.waiting.length ? "moving" : "waiting");
  const [tq, setTq] = useState("");
  const tw = tq.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = groups[tab].filter((t) => !tw.length || tw.every((w) => `${t.title} ${projectName(data, t.project_id)}`.toLowerCase().includes(w)));
  return (
    <DeskFrame kind="desk" eyebrow="ON THE DESKS" title="The desks" line={`${groups.moving.length} in motion · ${groups.waiting.length} waiting · ${groups.done.length} done.`} tab={tab} onTab={setTab} tabs={[{ id: "moving", label: "In motion", count: groups.moving.length }, { id: "waiting", label: "Waiting", count: groups.waiting.length }, { id: "done", label: "Done", count: groups.done.length }]}>
      <TextFind noun="tasks" q={tq} setQ={setTq} shown={rows.length} total={groups[tab].length} />
      {rows.length === 0 ? <Empty title={tab === "moving" ? "Nothing in motion." : tab === "waiting" ? "Nothing is waiting." : "Nothing finished yet."} /> :
        rows.map((t) => <div key={t.id} className="resolved-row"><span>{t.title}<small>{projectName(data, t.project_id)}</small></span><span className={`pill ${statusTone(t.status)}`}>{label(t.status).toUpperCase()}</span></div>)}
    </DeskFrame>
  );
}
