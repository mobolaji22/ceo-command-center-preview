import type { OwnerData, Task } from "../model";
import type { DecideItem, EngagementRow, FloorGroup, FloorView, HeldItem, InitiativeSetting, RoomCode, RoomInitiativeView, RoomMoveView, RoomView, RoomWorkState, StationView, StudioAskAnswer, StudioAskTopic, StudioView, WorkbenchKind } from "@/lib/studio/v4";

/**
 * The studio's views for the demo (v4 ADR-0099), worked out from the demo's own records the way v4 works them out from its tables, so
 * the office, the Floor and each room tell the same story as every other demo screen. This is the fixtures' imitation of v4; in
 * production every count, state and reason here comes from GET /v1/studio, /v1/floor and /v1/rooms/:room.
 */

export type StudioInput = {
  data: OwnerData;
  /** The rooms in v4's order, read from the demo's domain list (the only list of them in this repo). */
  rooms: readonly RoomCode[];
  /** The room a task's domain belongs to, by the domain's name as the demo's tasks carry it. */
  roomOfDomain: (domainName: string) => RoomCode | null;
  /** The object each room's station carries (v4 ROOM_SIGNATURES). */
  signatureOf: (room: RoomCode) => StationView["signature"];
  initiatives: Record<string, RoomInitiativeView>;
  lastSeen: string | null;
  isCeo: boolean;
};

/** The demo's approvals name no task, so the room each one belongs to is written here, by the domain whose work it signs off. */
const APPROVAL_DOMAIN: Record<string, string> = { "a-1": "Engineering", "a-2": "Design" };

const HELD = new Set(["WAITING", "BLOCKED", "FAILED"]);
const LIVE = new Set(["RUNNING", "READY", "PENDING", "QUEUED"]);
const CLOSED = new Set(["COMPLETED", "CANCELLED", "ARCHIVED"]);

export const DEFAULT_INITIATIVE: InitiativeSetting = { mode: 1, watches: [], cadence: "WEEKLY", interrupts: false };

function decideItems(i: StudioInput): DecideItem[] {
  const orgOf = new Map(i.data.projects.map((p) => [p.id, p.organization_id]));
  return i.data.approvals
    .filter((a) => a.status === "REQUESTED")
    .map((a) => {
      const domain = APPROVAL_DOMAIN[a.id];
      return {
        kind: "APPROVAL" as const, id: a.id, title: a.title, room: domain ? i.roomOfDomain(domain) : null,
        organizationId: orgOf.get(a.project_id) ?? "", projectId: a.project_id, since: a.created_at,
      };
    })
    .sort((a, b) => a.since.localeCompare(b.since));
}

const heldItem = (t: Task, room: RoomCode): HeldItem => ({
  taskId: t.id, title: t.title, projectId: t.project_id, room,
  reason: t.status === "WAITING" ? (t.approval_required ? "AWAITING_APPROVAL" : "HUMAN_TASK") : null,
  stopped: t.status as HeldItem["stopped"], since: t.started_at ?? t.created_at,
});

function roomState(tasks: Task[], needsYou: boolean): RoomWorkState {
  if (needsYou) return "NEEDS_YOU";
  if (tasks.some((t) => HELD.has(t.status))) return "HELD";
  if (tasks.some((t) => LIVE.has(t.status))) return "LIVE";
  if (tasks.length && tasks.every((t) => t.status === "COMPLETED")) return "DONE";
  return "IDLE";
}

const STAGE: Record<string, { stage: EngagementRow["stage"]; state: EngagementRow["state"] }> = {
  INTAKE: { stage: "UNDERSTAND", state: "MOVING" }, PROPOSED: { stage: "PLAN", state: "MOVING" }, ACTIVE: { stage: "MAKE", state: "MOVING" },
  WAITING: { stage: "MAKE", state: "MOVING" }, DELIVERED: { stage: "HAND_OVER", state: "MOVING" }, MONITORING: { stage: "LEARN", state: "MOVING" },
  COMPLETED: { stage: "LEARN", state: "CLOSED" }, PAUSED: { stage: "MAKE", state: "PAUSED" }, CANCELLED: { stage: null, state: "CLOSED" }, ARCHIVED: { stage: null, state: "CLOSED" },
};

export function floorFixture(i: StudioInput): FloorView {
  const decide = decideItems(i);
  const internal = i.data.organizations.filter((o) => o.kind === "INTERNAL").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const groups: FloorGroup[] = i.data.organizations
    .filter((o) => o.kind === "CLIENT" || o.kind === "INTERNAL")
    .map((o) => ({
      organizationId: o.id, name: o.name, kind: o.kind === "INTERNAL" ? ("INTERNAL" as const) : ("CLIENT" as const), studioOwn: internal[0]?.id === o.id,
      engagements: i.data.projects.filter((p) => p.organization_id === o.id && p.status !== "ARCHIVED").map((p): EngagementRow => {
        const tasks = i.data.tasks.filter((t) => t.project_id === p.id && t.status !== "CANCELLED");
        const mine = decide.filter((d) => d.projectId === p.id);
        const place = STAGE[p.status] ?? { stage: null, state: "CLOSED" as const };
        return {
          projectId: p.id, name: p.name, status: p.status as EngagementRow["status"], stage: place.stage, state: place.state,
          rooms: i.rooms.map((room) => ({ room, state: roomState(tasks.filter((t) => i.roomOfDomain(t.domain) === room), mine.some((d) => d.room === room)) })),
          needsYou: mine.length, held: tasks.filter((t) => HELD.has(t.status)).length,
          waitReason: p.status === "WAITING" ? "AWAITING_APPROVAL" : null,
          updatedAt: p.started_at ?? p.created_at,
        };
      }).sort((a, b) => b.needsYou - a.needsYou || b.held - a.held || Number(a.state === "CLOSED") - Number(b.state === "CLOSED")),
    }))
    .filter((g) => g.engagements.length)
    .sort((a, b) => b.engagements.reduce((n, e) => n + e.needsYou, 0) - a.engagements.reduce((n, e) => n + e.needsYou, 0));
  return { groups };
}

export function studioFixture(i: StudioInput): StudioView {
  const decide = decideItems(i);
  const open = i.data.projects.filter((p) => !CLOSED.has(p.status));
  const tasks = i.data.tasks.filter((t) => t.status !== "CANCELLED" && open.some((p) => p.id === t.project_id));
  const since = i.lastSeen;
  return {
    stations: i.rooms.map((room) => {
      const mine = tasks.filter((t) => i.roomOfDomain(t.domain) === room);
      return { room, signature: i.signatureOf(room), needsYou: decide.filter((d) => d.room === room).length, live: mine.filter((t) => LIVE.has(t.status)).length, held: mine.filter((t) => HELD.has(t.status)).length };
    }),
    decide: { count: decide.length, items: decide },
    know: { since, count: since ? i.data.events.filter((e) => e.created_at > since).length : i.data.events.length },
    board: {
      engagements: open.length,
      needsYou: new Set(decide.map((d) => d.projectId).filter((x) => x !== null)).size,
      held: open.filter((p) => tasks.some((t) => t.project_id === p.id && HELD.has(t.status))).length,
    },
  };
}

const NOT_YET: Partial<Record<RoomMoveView["move"], string>> = {
  REDO: "Sending finished work back is built for a person's step today. For the studio's own work it arrives with Engineering's review bench.",
  TIGHTEN_BAR: "A room's bar can be raised once an independent judge scores its work, which starts with the flagship site.",
};
const MOVES: ReadonlyArray<[RoomMoveView["move"], RoomMoveView["scope"]]> = [
  ["INITIATIVE", "ROOM"], ["REDIRECT", "ENGAGEMENT"], ["PAUSE", "ENGAGEMENT"], ["RESUME", "ENGAGEMENT"], ["STANDING_RULE", "ENGAGEMENT"], ["REDO", "ENGAGEMENT"], ["TIGHTEN_BAR", "ROOM"],
];

export function initiativeOf(i: Pick<StudioInput, "initiatives">, room: RoomCode): RoomInitiativeView {
  return i.initiatives[room] ?? { room, ...DEFAULT_INITIATIVE, isDefault: true, setById: null, setAt: null };
}

export function roomFixture(i: StudioInput, room: RoomCode, workbench: WorkbenchKind, projectId?: string): RoomView {
  const inScope = (pid: string | null) => projectId === undefined || pid === projectId;
  const tasks = i.data.tasks.filter((t) => t.status !== "CANCELLED" && i.roomOfDomain(t.domain) === room && inScope(t.project_id));
  const names = new Map(i.data.projects.map((p) => [p.id, p.name]));
  const byProject = new Map<string, Task[]>();
  for (const t of tasks) byProject.set(t.project_id, [...(byProject.get(t.project_id) ?? []), t]);
  return {
    room,
    glance: {
      live: tasks.filter((t) => LIVE.has(t.status)).length,
      needsYou: decideItems(i).filter((d) => d.room === room && inScope(d.projectId)),
      held: tasks.filter((t) => HELD.has(t.status)).map((t) => heldItem(t, room)),
      progress: [...byProject].map(([pid, ts]) => ({ projectId: pid, name: names.get(pid) ?? pid, done: ts.filter((t) => t.status === "COMPLETED").length, of: ts.length })),
      disagreements: [],
    },
    moves: MOVES.map(([move, scope]) => {
      const notYet = NOT_YET[move];
      if (notYet) return { move, scope, allowed: false, whyNot: notYet };
      if (move === "INITIATIVE" && !i.isCeo) return { move, scope, allowed: false, whyNot: "Only the CEO sets how much a room does on its own." };
      return { move, scope, allowed: true, whyNot: null };
    }),
    initiative: initiativeOf(i, room),
    workbench,
  };
}

/**
 * The composer for the demo, imitating v4's `askStudio`: a room or the Floor to open, a status answer from the demo's records, or
 * the words handed to the request flow. `roomNames` are the demo's room and domain names with the room each belongs to.
 */
export function askFixture(i: StudioInput, text: string, roomNames: ReadonlyArray<[string, RoomCode]>): StudioAskAnswer {
  const t = text.toLowerCase().replace(/[’‘]/g, "'").replace(/&/g, " and ").replace(/[^a-z0-9' ?]+/g, " ").replace(/\s+/g, " ").trim();
  const named = (s: string): RoomCode | null => roomNames.find(([n]) => new RegExp(`(?:^| )${n.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()}(?:$| |\\?)`).test(s))?.[1] ?? null;
  const floor = /^(?:floor|board|every engagement|all (?:the )?work|everything)$/;
  const go = /^(?:please )?(?:take me to|go to|open|show me|show|bring up|jump to|head to|walk me to) (?:the )?(.+?) ?\??$/.exec(t);
  if (go) {
    const target = go[1]!.trim();
    if (floor.test(target)) return { kind: "GO", place: "FLOOR", room: null };
    const room = named(target);
    if (room && target.split(" ").length <= 4) return { kind: "GO", place: "ROOM", room };
  }
  const bare = named(t);
  if (bare && t.split(" ").length <= 3 && !t.endsWith("?")) return { kind: "GO", place: "ROOM", room: bare };
  if (floor.test(t)) return { kind: "GO", place: "FLOOR", room: null };
  const asks = (text.trim().endsWith("?") || /^(?:what|what's|whats|which|who|anything|is|are|any|how many|how much|show me|tell me|catch me up|where)\b/.test(t)) && t.split(" ").length <= 14;
  const topic: StudioAskTopic | undefined = !asks ? undefined
    : /\b(?:needs? (?:me|my)|need me|waiting (?:on|for) me|my (?:turn|move|call|signature|yes)|for me to|to (?:sign|decide|approve)|decide)\b/.test(t) ? "NEEDS_YOU"
      : /\b(?:stuck|held|blocked|waiting|late|stalled|holding|paused|failed)\b/.test(t) ? "HELD"
        : /\b(?:new|happened|changed|since|catch me up|while i was away|missed)\b/.test(t) ? "NEW" : undefined;
  if (!topic) return { kind: "DIRECTIVE" };
  const room = named(t);
  const studio = studioFixture(i);
  const held = i.rooms.flatMap((r) => roomFixture(i, r, "CHOICES").glance.held);
  return {
    kind: "ANSWER", topic, room,
    decide: topic === "NEEDS_YOU" ? studio.decide.items.filter((d) => !room || d.room === room) : [],
    held: topic === "HELD" ? held.filter((h) => !room || h.room === room) : [],
    know: studio.know,
  };
}
