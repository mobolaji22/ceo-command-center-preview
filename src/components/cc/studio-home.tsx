"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Aperture, BookOpen, Braces, CalendarDays, Compass, LayoutTemplate, ListChecks, PanelTop, PenTool, Pencil, Scale, SlidersHorizontal, Sprout, Stamp, X, type LucideIcon } from "lucide-react";
import { COPY, say } from "@/copy";
import { ParkedCard, pinWords } from "@/components/kit";
import { useDataSource } from "@/lib/data";
import { useRooms } from "@/lib/domains";
import { label } from "@/lib/format";
import { useLighting } from "@/lib/lighting";
import type { OwnerData } from "@/lib/model";
import type { DecideItem, InitiativeCadence, RoomCode, RoomInitiativeView, RoomView, SignatureObject, StudioView } from "@/lib/studio/v4";
import { LitImage } from "./lit-image";
import { roomArt } from "./room-art";
import { spotsFor, type RoomSpot } from "./room-stage";
import { StudioPortrait } from "./studio-portrait";

/**
 * The studio home (v4 ADR-0099 Decisions 1, 3 and 9; Ola's picture of 2026-11-27): the office photograph is the stage. The studio head
 * hangs from the top edge and speaks first; the rooms wait behind a tab on the left edge; Decide, Know and Board are parked on the bottom
 * edge; a room rises from the bottom with its own photograph, and its menu opens from the side in stages. Pointing previews a move,
 * pressing makes it. Every count, item and reason is v4's (`StudioView`, `RoomView`); the words are the copy files'.
 */

const GLYPH: Record<SignatureObject, LucideIcon> = { COMPASS: Compass, SEAL: Stamp, PENCIL: Pencil, LENS: Aperture, BRACKETS: Braces, SPROUT: Sprout, SCALES: Scale };
const SPOT_ICON: Record<RoomSpot, LucideIcon> = { workshop: PenTool, book: BookOpen, desk: ListChecks, wall: PanelTop, calendar: CalendarDays };

const partOfDay = (d: Date): "morning" | "afternoon" | "evening" => (d.getHours() < 12 ? "morning" : d.getHours() < 18 ? "afternoon" : "evening");
const countWords = (n: number, t: { one: string; many: string }) => (n === 1 ? t.one : say(t.many, { count: n }));

/* ---------------------------------------------------------------- the studio head */

/** What the studio head says on arrival: a greeting, what waits on the pen, what changed, and an offer. Each part is a v4 count. */
export function headLines(view: StudioView, name: string, now: Date): { said: string; offer: string } {
  const h = COPY.studio.head;
  const part = partOfDay(now);
  const greet = name ? say(h.greet[part], { name }) : h.greetNoName[part];
  const decide = view.decide.count ? countWords(view.decide.count, h.decide) : h.decide.none;
  const know = view.know.count ? countWords(view.know.count, h.know) : "";
  return { said: [greet, decide, know].filter(Boolean).join(" "), offer: view.decide.count ? h.offer.decide : h.offer.clear };
}

export function StudioHead({ view, name, open, setOpen, onThrough, onRequests, composer }: {
  view: StudioView | undefined;
  name: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Takes the person to the first thing waiting on their pen, where it is dealt with. */
  onThrough: () => void;
  /** The person's own requests, the composer's record. */
  onRequests: () => void;
  composer: ReactNode;
}) {
  const h = COPY.studio.head;
  const id = useId();
  const [now] = useState(() => new Date());
  const lines = view ? headLines(view, name, now) : null;
  const calling = !!view && view.decide.count > 0;
  return (
    <div className={`studio-headman ${calling ? "is-calling" : ""}`}>
      <button type="button" className="sh-portrait" aria-label={h.toggle} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span className="sh-pulse" aria-hidden="true" /><span className="sh-pulse sh-pulse-2" aria-hidden="true" />
        <span className="sh-face"><StudioPortrait /></span>
        {calling && <span className="sh-dot" aria-hidden="true" />}
      </button>
      <span className="sh-who">{h.who}</span>
      <div id={id} className={`sh-say ${open ? "" : "is-shut"}`} inert={!open}>
        {lines ? <p className="sh-line" key={lines.said}>{words(lines.said)} <em>{words(lines.offer, lines.said.split(" ").length)}</em></p> : <p className="sh-line sh-wait"><span className="pulse-dot" /> {COPY.studio.scene.loading}</p>}
        {composer}
        <div className="sh-acts">
          {calling && <button type="button" className="sh-btn sh-btn-ink" onClick={onThrough}>{h.through}</button>}
          <button type="button" className="sh-quiet" onClick={onRequests}><ListChecks size={14} aria-hidden="true" />{COPY.studio.composer.requests}</button>
        </div>
      </div>
    </div>
  );
}

/** The studio head's words arrive one after another; screen readers get the sentence whole. */
function words(text: string, offset = 0) {
  return <span aria-label={text}>{text.split(" ").map((w, i, all) => <span key={i} aria-hidden="true" className="sh-w" style={{ ["--w" as string]: i + offset }}>{w}{i < all.length - 1 ? " " : ""}</span>)}</span>;
}

/* ---------------------------------------------------------------- the rooms */

export function RoomsMenu({ view, open, setOpen, onRoom }: { view: StudioView | undefined; open: boolean; setOpen: (open: boolean) => void; onRoom: (room: RoomCode) => void }) {
  const c = COPY.studio.rooms;
  const { roomName } = useRooms();
  const lighting = useLighting();
  const id = useId();
  const stations = view?.stations ?? [];
  const needs = stations.filter((s) => s.needsYou > 0).length;
  return (
    <>
      <button type="button" className={`rooms-tab ${open ? "is-hidden" : ""}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {needs > 0 && <span className="pen-count" aria-label={say(c.needs, { count: needs })}>{needs}</span>}
        <span className="rooms-tab-name">{c.tab}</span>
        <span className="rooms-tab-grip" aria-hidden="true" />
      </button>
      <aside id={id} className={`rooms-drawer ${open ? "is-open" : ""}`} aria-label={c.title} inert={!open}>
        <header className="rooms-drawer-head">
          <h2>{c.title}</h2>
          <button type="button" className="rd-close" aria-label={c.close} onClick={() => setOpen(false)}><X size={18} aria-hidden="true" /></button>
        </header>
        <p className="rd-sub">{say(c.crafts, { count: stations.length })}{needs > 0 && <> · <span className="is-pen">{say(c.needs, { count: needs })}</span></>}</p>
        <ul className="rd-list">
          {stations.map((s, i) => {
            const Glyph = GLYPH[s.signature];
            const art = roomArt(s.room);
            const name = roomName(s.room);
            const words = pinWords(s);
            return (
              <li key={s.room} style={{ ["--i" as string]: i }}>
                <button type="button" className={`rd-room ${s.needsYou ? "is-pen" : ""}`} aria-label={`${name}: ${words.join(", ")}`} onClick={() => onRoom(s.room)}>
                  <span className="rd-thumb">{art && <Image src={lighting === "day" ? art.day : art.night} alt="" fill sizes="72px" quality={55} />}</span>
                  <span className="rd-glyph"><Glyph size={17} strokeWidth={1.5} aria-hidden="true" /></span>
                  <span className="rd-text"><b>{name}</b><em>{words.join(" · ")}</em></span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}

/* ---------------------------------------------------------------- Decide, Know, Board */

export type CardName = "decide" | "know" | "board";
const SHOWN = 5;

export function StudioCards({ view, open, setOpen, onItem, onSign, onBrief, onFloor }: {
  view: StudioView;
  open: CardName | null;
  setOpen: (card: CardName | null) => void;
  onItem: (item: DecideItem) => void;
  onSign: () => void;
  onBrief: () => void;
  onFloor: () => void;
}) {
  const s = COPY.studio;
  const { roomName } = useRooms();
  const toggle = (card: CardName) => () => setOpen(open === card ? null : card);
  const d = view.decide;
  const b = view.board;
  const knowLine = view.know.count === 0 ? s.know.empty : view.know.since ? say(s.know.count, { count: view.know.count }) : say(s.know.first, { count: view.know.count });
  return (
    <div className="parked-dock" role="group" aria-label={s.cards.label}>
      <ParkedCard className="parked-decide" name={s.decide.title} line={d.count ? countWords(d.count, { one: s.decide.countOne, many: s.decide.countMany }) : s.decide.empty} pen={d.count > 0} open={open === "decide"} onToggle={toggle("decide")}>
        {d.items.length > 0 ? <ul className="parked-list">
          {d.items.slice(0, SHOWN).map((item, i) => (
            <li key={`${item.kind}:${item.id}`} style={{ ["--i" as string]: i }}>
              <button type="button" className="parked-item" onClick={() => onItem(item)}>
                <span className="pi-kind">{s.decide.kinds[item.kind]}</span>
                <span className="pi-title">{item.title}</span>
                <span className="pi-note">{item.room ? roomName(item.room) : s.decide.noRoom}</span>
              </button>
            </li>
          ))}
          {d.items.length > SHOWN && <li className="parked-more">{say(s.decide.more, { count: d.items.length - SHOWN })}</li>}
        </ul> : <p className="parked-empty">{s.decide.empty}</p>}
        <button type="button" className="sh-btn" onClick={onSign}>{s.decide.all}</button>
      </ParkedCard>
      <ParkedCard className="parked-know" name={s.know.title} line={view.know.count ? say(view.know.since ? s.know.short : s.know.first, { count: view.know.count }) : s.know.quiet} open={open === "know"} onToggle={toggle("know")}>
        <p className="parked-say">{knowLine}</p>
        <button type="button" className="sh-btn" onClick={onBrief}>{s.know.open}</button>
      </ParkedCard>
      <ParkedCard className="parked-board" name={s.board.title} line={say(s.board.summary, { count: b.engagements })} open={open === "board"} onToggle={toggle("board")}>
        <p className="parked-say">{say(s.board.summary, { count: b.engagements })}</p>
        {(b.needsYou > 0 || b.held > 0) && <p className="parked-marks">
          {b.needsYou > 0 && <span className="is-pen">{say(s.board.needsYou, { count: b.needsYou })}</span>}
          {b.held > 0 && <span>{say(s.board.held, { count: b.held })}</span>}
        </p>}
        <button type="button" className="sh-btn" onClick={onFloor}>{s.board.open}</button>
      </ParkedCard>
    </div>
  );
}

/* ---------------------------------------------------------------- a room */

type Section = "bench" | "steer" | "glance";

export function RoomPanel({ room, data, onClose, onSpot, onItem, onSeed, refresh }: {
  room: RoomCode | null;
  data: OwnerData | undefined;
  onClose: () => void;
  onSpot: (room: RoomCode, spot: RoomSpot) => void;
  onItem: (item: DecideItem) => void;
  /** Starts a request to the studio head with the room's words (a change of course, a standing rule). */
  onSeed: (text: string) => void;
  refresh: () => void;
}) {
  const r = COPY.room;
  const p = r.panel;
  const ds = useDataSource();
  const { roomName } = useRooms();
  const [shown, setShown] = useState<RoomCode | null>(room);
  if (room && room !== shown) setShown(room);
  const code = room ?? shown;
  const q = useQuery({ queryKey: ["room", code], queryFn: () => ds.queries.room(code!), enabled: !!code });
  const [stage, setStage] = useState(0);
  const [section, setSection] = useState<Section>("bench");
  const timers = useRef<number[]>([]);
  const panelId = useId();

  // The menu opens in stages: the rail slides in, the sheet widens, then what is on it settles. It closes in the reverse order.
  const menu = (open: boolean, to: Section = section) => {
    timers.current.forEach(clearTimeout);
    if (open) { setSection(to); setStage(1); timers.current = [window.setTimeout(() => setStage(2), 190), window.setTimeout(() => setStage(3), 420)]; }
    else { setStage(2); timers.current = [window.setTimeout(() => setStage(1), 120), window.setTimeout(() => setStage(0), 320)]; }
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const [lastRoom, setLastRoom] = useState(room);
  if (room !== lastRoom) { setLastRoom(room); setStage(0); }

  useEffect(() => {
    if (!room) return;
    const esc = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.preventDefault(); if (stage > 0) menu(false); else onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  });

  const art = code ? roomArt(code) : null;
  const v = q.data;
  const name = code ? roomName(code) : "";
  const pin = v ? pinWords({ needsYou: v.glance.needsYou.length, live: v.glance.live, held: v.glance.held.length }) : [];
  return (
    <>
      <div className={`room-veil ${room ? "is-on" : ""}`} onClick={onClose} aria-hidden="true" />
      <section className={`room-card ${room ? "is-open" : ""} ${stage ? "has-menu" : ""}`} role="dialog" aria-modal="true" aria-label={name} inert={!room}>
        <div className="room-photo">{art && <LitImage art={art} sizes="(max-width: 860px) 100vw, 1120px" quality={70} className="room-photo-img" />}</div>
        <div className="room-float room-title">
          <h2>{name}</h2>
          {v && <p className={v.glance.needsYou.length ? "is-pen" : ""}>{pin.join(" · ")}</p>}
        </div>
        <button type="button" className="room-float room-round room-close" aria-label={p.back} onClick={onClose} inert={stage > 0}><X size={18} aria-hidden="true" /></button>
        <button type="button" className="room-float room-steer" aria-expanded={stage > 0} aria-controls={panelId} onClick={() => menu(stage === 0, "bench")} inert={stage > 0}>
          <SlidersHorizontal size={16} aria-hidden="true" /><span>{p.steer}</span>
        </button>
        {v && <div className="room-float room-glance">{v.glance.needsYou.length + v.glance.held.length + v.glance.progress.length > 0 ? <Glance v={v} onItem={onItem} max={3} /> : <p className="rg-quiet">{r.glance.quiet}</p>}</div>}
        {!v && room && <p className="room-float room-glance rg-quiet">{q.isError ? (q.error as Error).message : p.loading}</p>}

        <div id={panelId} className={`room-menu stage-${stage}`}>
          <nav className="rm-rail" aria-label={p.menu} inert={stage === 0}>
            {(["bench", "steer", "glance"] as const).map((s) => {
              const Icon = s === "bench" ? LayoutTemplate : s === "steer" ? SlidersHorizontal : ListChecks;
              return <button key={s} type="button" aria-current={section === s && stage > 0 ? "true" : undefined} onClick={() => (stage === 0 ? menu(true, s) : setSection(s))}><Icon size={18} aria-hidden="true" /><span>{p.sections[s]}</span></button>;
            })}
            <button type="button" className="rm-close" onClick={() => menu(false)}><X size={18} aria-hidden="true" /><span>{p.closeMenu}</span></button>
          </nav>
          <div className="rm-sheet" inert={stage < 2}>
            <div className="rm-inner" key={section}>
              {code && section === "bench" && <>
                <h3>{p.benchTitle}</h3><p className="rm-lab">{p.benchLine}</p>
                <div className="rm-benches">{spotsFor(code).map((spot) => {
                  const Icon = SPOT_ICON[spot];
                  const [title, line] = r.spots[spot];
                  return <button key={spot} type="button" className="rm-bench" onClick={() => onSpot(code, spot)}><Icon size={18} aria-hidden="true" /><span><b>{title}</b><small>{line}</small></span></button>;
                })}</div>
              </>}
              {code && section === "steer" && v && <Steer v={v} data={data} roomName={name} onSeed={onSeed} refresh={refresh} />}
              {section === "glance" && v && <><h3>{p.glanceTitle}</h3><p className="rm-lab">{pin.join(" · ")}</p><Glance v={v} onItem={onItem} /></>}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Glance({ v, onItem, max }: { v: RoomView; onItem: (item: DecideItem) => void; max?: number }) {
  const g = COPY.room.glance;
  const kinds = COPY.studio.decide.kinds;
  const rows: ReactNode[] = [
    ...v.glance.needsYou.map((d) => <li key={`n:${d.id}`} className="is-pen"><button type="button" onClick={() => onItem(d)}><b>{d.title}</b><span>{kinds[d.kind]}</span></button></li>),
    ...v.glance.disagreements.map((h) => <li key={`d:${h.taskId}`}><b>{h.title}</b><span>{g.disagreements}</span></li>),
    ...v.glance.held.map((h) => <li key={`h:${h.taskId}`}><b>{h.title}</b><span>{h.reason ? label(h.reason) : g.held}</span></li>),
    ...v.glance.progress.map((p) => <li key={`p:${p.projectId}`}><b>{p.name}</b><span>{say(g.progressOf, { done: p.done, of: p.of })}</span></li>),
  ];
  return <ul className="rg-list">{max ? rows.slice(0, max) : rows}</ul>;
}

function Steer({ v, data, roomName, onSeed, refresh }: { v: RoomView; data: OwnerData | undefined; roomName: string; onSeed: (text: string) => void; refresh: () => void }) {
  const r = COPY.room;
  const p = r.panel;
  const ds = useDataSource();
  const qc = useQueryClient();
  const allowed = (m: RoomView["moves"][number]["move"]) => v.moves.find((x) => x.move === m);
  const [mode, setMode] = useState(v.initiative.mode);
  const [cadence, setCadence] = useState<InitiativeCadence>(v.initiative.cadence);
  const [interrupts, setInterrupts] = useState(v.initiative.interrupts);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const dirty = mode !== v.initiative.mode || cadence !== v.initiative.cadence || interrupts !== v.initiative.interrupts;
  const initiative = allowed("INITIATIVE");
  const save = async () => {
    setBusy(true);
    const res = await ds.commands.setInitiative(v.room, { mode, cadence, interrupts, watches: v.initiative.watches });
    setBusy(false);
    if (res.error) { setNote(res.error.message); return; }
    setNote(r.initiative.saved);
    qc.setQueryData<RoomView>(["room", v.room], (old) => (old && res.data ? { ...old, initiative: res.data as RoomInitiativeView } : old));
  };
  const projects = v.glance.progress.map((g) => ({ id: g.projectId, name: g.name, paused: data?.projects.find((x) => x.id === g.projectId)?.status === "PAUSED" }));
  const [pausing, setPausing] = useState("");
  const pause = async (id: string, paused: boolean) => {
    setPausing(id);
    const res = paused ? await ds.runs.resume(id) : await ds.runs.pause(id);
    setPausing("");
    if (res.error) setNote(res.error.message); else refresh();
  };
  const pauseMove = allowed("PAUSE");
  const modes = [0, 1, 2, 3, 4, 5] as const;
  return <>
    <h3>{p.steerTitle}</h3>
    <div className="st-group">
      <p className="rm-lab">{r.initiative.title}</p>
      <div className="st-dial" role="radiogroup" aria-label={r.initiative.title}>
        {modes.map((m) => <button key={m} type="button" role="radio" aria-checked={mode === m} aria-label={r.initiative.modes[m]} disabled={!initiative?.allowed} className={m <= mode ? "is-on" : ""} onClick={() => setMode(m)}><span /></button>)}
      </div>
      <p className="st-mode">{r.initiative.modes[mode]}</p>
      {!initiative?.allowed && initiative?.whyNot && <p className="st-why">{initiative.whyNot}</p>}
      <div className="st-row">
        <span>{p.cadence}</span>
        <span className="st-seg" role="radiogroup" aria-label={r.initiative.cadence}>
          {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((c) => <button key={c} type="button" role="radio" aria-checked={cadence === c} disabled={!initiative?.allowed} onClick={() => setCadence(c)}>{r.initiative.cadences[c]}</button>)}
        </span>
      </div>
      <button type="button" role="switch" className="st-switch" aria-checked={interrupts} disabled={!initiative?.allowed} onClick={() => setInterrupts(!interrupts)}>
        <span>{interrupts ? r.initiative.interrupts : r.initiative.waits}</span><b aria-hidden="true" />
      </button>
      {dirty && <button type="button" className="sh-btn sh-btn-ink st-save" disabled={busy} onClick={save}>{p.dirty}</button>}
      {note && <p className="st-note" role="status">{note}</p>}
    </div>
    <div className="st-group">
      <p className="rm-lab">{p.pauseTitle}</p>
      {projects.length === 0 ? <p className="st-why">{p.noWork}</p> : projects.map((pr) => (
        <button key={pr.id} type="button" role="switch" className="st-switch" aria-checked={pr.paused} aria-label={say(p.pause, { name: pr.name })} disabled={!pauseMove?.allowed || pausing === pr.id} onClick={() => void pause(pr.id, pr.paused)}>
          <span>{pr.name}{pr.paused && <em> · {p.paused}</em>}</span><b aria-hidden="true" />
        </button>
      ))}
    </div>
    <div className="st-moves">
      {allowed("REDIRECT")?.allowed && <button type="button" onClick={() => onSeed(say(p.redirectSeed, { room: roomName }))}>{r.steer.moves.REDIRECT}</button>}
      {allowed("STANDING_RULE")?.allowed && <button type="button" onClick={() => onSeed(say(p.ruleSeed, { room: roomName }))}>{r.steer.moves.STANDING_RULE}</button>}
    </div>
    {v.moves.some((m) => !m.allowed && m.whyNot && m.move !== "INITIATIVE") && <div className="st-group st-later">
      <p className="rm-lab">{p.notYet}</p>
      {v.moves.filter((m) => !m.allowed && m.whyNot && m.move !== "INITIATIVE").map((m) => <p key={m.move} className="st-why"><b>{r.steer.moves[m.move]}.</b> {m.whyNot}</p>)}
    </div>}
  </>;
}
