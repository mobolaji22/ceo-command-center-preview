"use client";

import { Aperture, Braces, Compass, Pencil, Scale, Sprout, Stamp, type LucideIcon } from "lucide-react";
import { COPY, say } from "@/copy";
import { DockCard, Pin, pinWords } from "@/components/kit";
import { useRooms } from "@/lib/domains";
import type { DecideItem, SignatureObject, StudioView } from "@/lib/studio/v4";

/**
 * The studio's home (v4 ADR-0099 Decisions 1 and 3): one bench with a station for each room, each carrying the tool of its craft and
 * v4's pin, and three cards docked at its edges. This is the composed scene, drawn in code from the theme's tokens, which every install
 * has; a brand that holds its own scene image and anchors (Decision 2) is drawn from them when the brand record carries imagery.
 * Nothing here counts or decides: every number and item is `StudioView`.
 */
const GLYPH: Record<SignatureObject, LucideIcon> = { COMPASS: Compass, SEAL: Stamp, PENCIL: Pencil, LENS: Aperture, BRACKETS: Braces, SPROUT: Sprout, SCALES: Scale };

export function StudioBench({ view, onEnter }: { view: StudioView; onEnter: (room: string) => void }) {
  const { roomName } = useRooms();
  return (
    <ol className="bench" aria-label={COPY.studio.scene.label}>
      {view.stations.map((s, i) => {
        const Glyph = GLYPH[s.signature];
        const name = roomName(s.room);
        return (
          <li key={s.room} className={`station ${s.needsYou ? "station-needs" : ""}`} style={{ ["--i" as string]: i }}>
            <button type="button" className="station-button" aria-label={`${name}: ${pinWords(s).join(", ")}`} onClick={() => onEnter(s.room)}>
              <span className="station-object" aria-hidden="true"><Glyph size={30} strokeWidth={1.25} /></span>
              <span className="station-name">{name}</span>
              <Pin needsYou={s.needsYou} live={s.live} held={s.held} />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const SHOWN = 5;

/** Decide: everything that waits on the person, oldest first, each opening where it is dealt with. */
export function DecideCard({ view, onItem, onAll }: { view: StudioView; onItem: (item: DecideItem) => void; onAll: () => void }) {
  const c = COPY.studio.decide;
  const { roomName } = useRooms();
  const items = view.decide.items;
  return (
    <DockCard className="dock-decide" title={c.title} count={view.decide.count} countLine={view.decide.count ? say(c.count, { count: view.decide.count }) : c.empty} action={c.all} onOpen={onAll}>
      {items.length > 0 && <ul className="decide-list">
        {items.slice(0, SHOWN).map((d) => (
          <li key={`${d.kind}:${d.id}`}>
            <button type="button" className="decide-item" onClick={() => onItem(d)}>
              <span className="decide-kind">{c.kinds[d.kind]}</span>
              <span className="decide-title">{d.title}</span>
              <span className="decide-room">{d.room ? roomName(d.room) : c.noRoom}</span>
            </button>
          </li>
        ))}
        {items.length > SHOWN && <li className="decide-more">{say(c.more, { count: items.length - SHOWN })}</li>}
      </ul>}
    </DockCard>
  );
}

/** Know: how much happened since the person last looked; the brief holds each thing. */
export function KnowCard({ view, onOpen }: { view: StudioView; onOpen: () => void }) {
  const c = COPY.studio.know;
  const line = view.know.count === 0 ? c.empty : view.know.since ? say(c.count, { count: view.know.count }) : say(c.first, { count: view.know.count });
  return <DockCard className="dock-know" title={c.title} count={view.know.count} countLine={line} action={c.open} onOpen={onOpen} />;
}

/** Board: the engagements on the bench, and how many need the person or are held; it opens into the Floor. */
export function BoardCard({ view, onOpen }: { view: StudioView; onOpen: () => void }) {
  const c = COPY.studio.board;
  const b = view.board;
  return (
    <DockCard className="dock-board" title={c.title} count={b.engagements} countLine={say(c.summary, { count: b.engagements })} action={c.open} onOpen={onOpen}>
      {(b.needsYou > 0 || b.held > 0) && <p className="board-marks">
        {b.needsYou > 0 && <span className="board-mark board-needs">{say(c.needsYou, { count: b.needsYou })}</span>}
        {b.held > 0 && <span className="board-mark board-held">{say(c.held, { count: b.held })}</span>}
      </p>}
    </DockCard>
  );
}
