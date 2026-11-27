"use client";

import { useState } from "react";
import { COPY, say } from "@/copy";
import { useRooms } from "@/lib/domains";
import { label } from "@/lib/format";
import type { EngagementRow, FloorGroup, FloorView, RoomWorkState } from "@/lib/studio/v4";

/**
 * The Floor (v4 ADR-0099 Decision 14): every engagement at once, in v4's groups and v4's order (what needs the person first). Read a
 * row across for one engagement through every room, or a column down for one room across every engagement. The filters only choose
 * which of v4's rows to show; nothing is counted or sorted here.
 */
type Show = "all" | "needsYou" | "held";

export function FloorSurface({ view, onEngagement, onRoom, onDetail, onRecords }: {
  view: FloorView;
  onEngagement: (projectId: string) => void;
  onRoom: (room: string, projectId: string) => void;
  onDetail: () => void;
  /** Every engagement's records and the library, until they become a room's shelf (4.3). */
  onRecords: () => void;
}) {
  const c = COPY.floor;
  const { rooms, roomName } = useRooms();
  const [show, setShow] = useState<Show>("all");
  const [room, setRoom] = useState("");
  const [group, setGroup] = useState("");
  const groupName = (g: FloorGroup) => (g.kind === "CLIENT" ? g.name : g.studioOwn ? c.studioOwn : c.yourWork);
  const keep = (e: EngagementRow) =>
    (show === "all" || (show === "needsYou" ? e.needsYou > 0 : e.held > 0)) &&
    (!room || e.rooms.some((r) => r.room === room && r.state !== "IDLE"));
  const groups = view.groups.filter((g) => !group || g.organizationId === group).map((g) => ({ ...g, engagements: g.engagements.filter(keep) })).filter((g) => g.engagements.length);
  const columns = rooms.length ? rooms : (view.groups[0]?.engagements[0]?.rooms.map((r) => ({ code: r.room, name: roomName(r.room) })) ?? []);

  return (
    <div className="floor">
      <div className="floor-tools" role="group" aria-label={c.filters.label}>
        {(["all", "needsYou", "held"] as const).map((s) => (
          <button key={s} type="button" className="floor-chip" aria-pressed={show === s} onClick={() => setShow(s)}>{c.filters[s]}</button>
        ))}
        <select className="floor-select" aria-label={c.filters.anyRoom} value={room} onChange={(e) => setRoom(e.target.value)}>
          <option value="">{c.filters.anyRoom}</option>
          {columns.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
        </select>
        <select className="floor-select" aria-label={c.filters.anyGroup} value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">{c.filters.anyGroup}</option>
          {view.groups.map((g) => <option key={g.organizationId} value={g.organizationId}>{groupName(g)}</option>)}
        </select>
        <button type="button" className="floor-detail" onClick={onDetail}>{c.detail}</button>
        <button type="button" className="floor-detail" onClick={onRecords}>{c.records}</button>
      </div>

      {view.groups.length === 0 ? <p className="floor-empty">{c.empty}</p>
        : groups.length === 0 ? <p className="floor-empty">{c.nothingMatches}</p>
          : <div className="floor-scroll"><table className="floor-table">
            <thead>
              <tr>
                <th scope="col" className="floor-col-name"><span className="sr-only">{c.columns.engagement}</span></th>
                <th scope="col" className="floor-col-stage"><span className="sr-only">{c.columns.stage}</span></th>
                {columns.map((r) => <th key={r.code} scope="col" className="floor-col-room" title={r.name}><span className="floor-room-head">{r.name}</span></th>)}
                <th scope="col" className="floor-col-counts"><span className="sr-only">{c.columns.counts}</span></th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.organizationId} className={`floor-group floor-${g.kind === "CLIENT" ? "client" : g.studioOwn ? "studio" : "own"}`}>
                <tr className="floor-group-row"><th scope="rowgroup" colSpan={columns.length + 3} className="floor-group-name">{groupName(g)}</th></tr>
                {g.engagements.map((e) => <Row key={e.projectId} e={e} columns={columns} onEngagement={onEngagement} onRoom={onRoom} />)}
              </tbody>
            ))}
          </table></div>}
    </div>
  );
}

function Row({ e, columns, onEngagement, onRoom }: {
  e: EngagementRow; columns: Array<{ code: string; name: string }>;
  onEngagement: (projectId: string) => void; onRoom: (room: string, projectId: string) => void;
}) {
  const c = COPY.floor;
  const stateOf = (code: string): RoomWorkState => e.rooms.find((r) => r.room === code)?.state ?? "IDLE";
  return (
    <tr className={`floor-row floor-${e.state.toLowerCase()} ${e.needsYou ? "floor-row-needs" : ""}`}>
      <th scope="row" className="floor-col-name">
        <button type="button" className="floor-name" onClick={() => onEngagement(e.projectId)}>{e.name}</button>
        {e.waitReason && <span className="floor-wait">{say(c.waits, { reason: label(e.waitReason) })}</span>}
      </th>
      <td className="floor-col-stage">
        <span className="floor-stage">{e.stage ? c.stages[e.stage] : c.noStage}</span>
        {e.state !== "MOVING" && <span className="floor-state">{c.states[e.state]}</span>}
      </td>
      {columns.map((r) => {
        const s = stateOf(r.code);
        const words = say(c.mark, { room: r.name, state: c.roomStates[s] });
        return (
          <td key={r.code} className="floor-col-room">
            {s === "IDLE" ? <span className="floor-mark mark-idle" title={words}><span className="sr-only">{words}</span></span>
              : <button type="button" className={`floor-mark mark-${s.toLowerCase()}`} title={words} aria-label={`${e.name}, ${words}`} onClick={() => onRoom(r.code, e.projectId)} />}
          </td>
        );
      })}
      <td className="floor-col-counts">
        {e.needsYou > 0 && <span className="floor-count count-needs">{say(c.needsYou, { count: e.needsYou })}</span>}
        {e.held > 0 && <span className="floor-count count-held">{say(c.held, { count: e.held })}</span>}
      </td>
    </tr>
  );
}
