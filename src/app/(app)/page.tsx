"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, FileCheck2, FolderOpen, Keyboard, LayoutGrid, LogOut, Monitor, PenLine, PenTool, Settings2, Sparkles, Sun, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useDataSource } from "@/lib/data";
import { BriefView, ComputerView, ContractsView, DirectiveView } from "@/components/cc/views";
import { domainOrder } from "@/components/cc/domain-work";
import { useDomains, useRooms } from "@/lib/domains";
import { RoomDesk, RoomStage, spotsFor, type RoomSpot } from "@/components/cc/room-stage";
import { SceneFrame, ThresholdVeil, directionBetween, isOverlayMove, type SceneOrigin } from "@/components/cc/scene";
import { DeskOverlay } from "@/components/cc/desk-overlay";
import { DeskSkeleton } from "@/components/cc/desk-skeleton";
import { SettingsView } from "@/components/cc/settings";
import { AccountMenu, TopBar } from "@/components/cc/top-bar";
import type { SceneDir } from "@/lib/motion";
import { CursorLight } from "@/components/cc/cursor-light";
import { ManageView } from "@/components/cc/manage";
import { ContractsDesk } from "@/components/cc/runs";
import { RoomKeys, type KeyBinding, type PaletteCommand } from "@/components/cc/command-palette";
import { readPlace, usePlaceFromHistory, writePlace, type Place } from "@/lib/place";
import { setLighting, useLighting } from "@/lib/lighting";
import { label } from "@/lib/format";
import type { OwnerData } from "@/lib/model";
import { RollingNumber } from "@/components/kit";
import { useAgencyBrand } from "@/lib/brand";
import { BoardCard, DecideCard, KnowCard, StudioBench } from "@/components/cc/studio-scene";
import { FloorSurface } from "@/components/cc/floor";
import { Composer } from "@/components/cc/composer";
import { COPY, say } from "@/copy";
import type { DecideItem } from "@/lib/studio/v4";

const ownerKey = ["owner-data"] as const;
const studioKey = ["studio"] as const;
const floorKey = ["floor"] as const;

/**
 * The CEO's studio (v4 ADR-0099, Plan §13.0 step 4, slice 4.2): one bench with a station for each room, Decide, Know and Board docked
 * at its edges, the Floor behind Board, and the studio head's composer at the foot. Every count and item is v4's (`GET /v1/studio`,
 * `/v1/floor`); the desks that do the work open over the scene from the card that names it, until each is re-cut into its room.
 */
const CEO_DESKS = ["computer", "contracts", "directive", "brief", "manage", "settings"] as const;
const isDesk = (v: string): boolean => (CEO_DESKS as readonly string[]).includes(v);

type View = "office" | "floor" | "computer" | "contracts" | "directive" | "brief" | "room" | "roomdesk" | "manage" | "settings";

/** The letter that opens each place (lib/shortcuts), shown in the palette. */
const KEYS: Partial<Record<View, string>> = { contracts: "c", brief: "b", floor: "f", computer: "o", directive: "d", manage: "r", settings: "s" };
const NAMES: Partial<Record<View, string>> = {
  contracts: COPY.studio.decide.all, brief: COPY.studio.know.open, floor: COPY.floor.title, computer: COPY.floor.detail,
  directive: COPY.studio.composer.requests, manage: COPY.studio.palette.records, settings: COPY.studio.palette.settings,
};
const ROOM_SPOTS: readonly RoomSpot[] = ["wall", "calendar", "desk", "workshop", "book"];

/** Where you are, as the address bar says it (lib/place). The records explorer is "records" there; the code calls it manage. */
function placeOf(view: View, dept: string, spot: RoomSpot, project: string | undefined, item: string | undefined): Place {
  if (isDesk(view)) return { desk: view === "manage" ? "records" : view, project, item };
  if (view === "floor") return { at: "floor" };
  if (view === "room") return { room: dept };
  if (view === "roomdesk") return { room: dept, spot };
  return {};
}

/**
 * Where a Decide item is dealt with today: a question on one of your requests where the request is, anything else to sign or
 * answer at the signing desk, a stopped step with the work in detail.
 */
const deskFor = (d: DecideItem, data: OwnerData | undefined): View => {
  if (d.kind === "QUESTION" && data?.intents.some((i) => i.questions.some((q) => q.id === d.id))) return "directive";
  return d.kind === "APPROVAL" || d.kind === "PLAN" || d.kind === "QUESTION" ? "contracts" : "computer";
};

export default function Index() {
  const brand = useAgencyBrand();
  const brandName = brand.name.toUpperCase();
  const auth = useAuth();
  const router = useRouter();
  const ds = useDataSource();
  const qc = useQueryClient();
  const domains = useDomains();
  const { rooms, roomName } = useRooms();
  const [arrival] = useState<Place>(() => (typeof window === "undefined" ? {} : readPlace()));
  useEffect(() => {
    if (auth.loading || !auth.user || auth.isOwner) return;
    if (auth.isStaff) { router.replace("/team"); return; }
    // A link to a project's Workshop (the question about a design direction carries one) opens the client's view of the same design.
    router.replace(arrival.spot === "workshop" && arrival.project ? `/client?desk=design&project=${encodeURIComponent(arrival.project)}` : "/client");
  }, [auth, router, arrival]);
  const q = useQuery({ queryKey: ownerKey, queryFn: () => ds.queries.ownerData(), enabled: auth.isOwner });
  const studio = useQuery({ queryKey: studioKey, queryFn: () => ds.queries.studio(), enabled: auth.isOwner });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ownerKey }); void qc.invalidateQueries({ queryKey: studioKey }); void qc.invalidateQueries({ queryKey: floorKey }); };

  const [view, setView] = useState<View>("office");
  const floor = useQuery({ queryKey: floorKey, queryFn: () => ds.queries.floor(), enabled: auth.isOwner && view === "floor" });
  const [dept, setDept] = useState("");
  const [roomSpot, setRoomSpot] = useState<RoomSpot>("wall");
  const [roomAt, setRoomAt] = useState<SceneOrigin | undefined>();
  const [focusProject, setFocusProject] = useState<string | undefined>();
  const [focusItem, setFocusItem] = useState<string | undefined>();
  const [palette, setPalette] = useState(false);
  const [keySheet, setKeySheet] = useState(false);
  const day = useLighting() === "day";
  const [dir, setDir] = useState<SceneDir>("none");
  const [origin, setOrigin] = useState<SceneOrigin | undefined>();

  // A desk opens over the studio (the studio stays mounted behind it), so moving between the studio and a desk is not a change of scene.
  const overlay = (next: View) => isOverlayMove(view, next, CEO_DESKS, "office") || isOverlayMove(view, next, ["roomdesk"], "room") || (isDesk(view) && isDesk(next));
  const openView = (next: View, projectId?: string, at?: SceneOrigin, itemId?: string) => { setDir(overlay(next) ? "none" : directionBetween(view, next)); setOrigin(at); setFocusProject(projectId); setFocusItem(itemId); setView(next); };
  const enterRoom = (d: string, spot?: RoomSpot, projectId?: string) => { setDept(d); if (spot) { setRoomSpot(spot); setRoomAt(undefined); openView("roomdesk", projectId); } else openView("room", projectId); };

  const [restored, setRestored] = useState(false);
  usePlaceFromHistory((p) => {
    const desk = p.desk === "records" ? "manage" : p.desk;
    const spot = ROOM_SPOTS.find((s) => s === p.spot);
    if (desk && isDesk(desk)) openView(desk as View, p.project, undefined, p.item);
    else if (p.at === "floor") openView("floor");
    else if (p.room && /^[A-Z_]+$/.test(p.room)) enterRoom(p.room, spot && spotsFor(p.room).includes(spot) ? spot : undefined);
    else if (view !== "office") openView("office");
    setRestored(true);
  });
  useEffect(() => { if (restored) writePlace(placeOf(view, dept, roomSpot, focusProject, focusItem)); }, [restored, view, dept, roomSpot, focusProject, focusItem]);
  // A room named in a link that the agency does not have goes back to the studio (adjusted during render, not in an effect).
  if ((view === "room" || view === "roomdesk") && domains.list.length > 0 && !domains.list.some((d) => d.code === dept)) setView("office");
  const [recentRooms, setRecentRooms] = useState<string[]>([]);
  if ((view === "room" || view === "roomdesk") && dept && recentRooms[0] !== dept) setRecentRooms([dept, ...recentRooms.filter((d) => d !== dept)].slice(0, 3));
  const signOut = async () => { await qc.cancelQueries(); qc.clear(); await ds.auth.signOut(); router.replace("/auth"); };

  const data = q.data;
  const sv = studio.data;
  const waiting = sv?.decide.count ?? 0;
  const initials = (auth.user?.email ?? "OM").slice(0, 2).toUpperCase();
  const account = <AccountMenu initials={initials} onSettings={() => openView("settings")} onSignOut={signOut} onSearch={() => setPalette(true)} onKeys={() => setKeySheet(true)} />;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  const places = ["contracts", "brief", "floor", "computer", "directive", "manage", "settings"] as const;
  const go = (v: View) => () => { if (v === "floor" || data) openView(v); };
  const bindings: KeyBinding[] = places.map((v) => ({ key: KEYS[v]!, label: NAMES[v]!, run: go(v) }));
  const icon: Partial<Record<View, typeof Monitor>> = { contracts: FileCheck2, brief: Sparkles, floor: LayoutGrid, computer: Monitor, directive: PenLine, manage: FolderOpen, settings: Settings2 };
  const codes = data ? domainOrder(data, domains.list) : [];
  const commands: PaletteCommand[] = [
    ...(sv?.decide.items.map((d) => ({ id: `decide:${d.kind}:${d.id}`, group: COPY.studio.decide.title, label: d.title, hint: COPY.studio.decide.kinds[d.kind], icon: FileCheck2, run: () => openView(deskFor(d, data), d.projectId ?? undefined, undefined, d.id) })) ?? []),
    ...recentRooms.filter((code) => rooms.some((r) => r.code === code) && !(view === "room" && code === dept)).map((code) => ({ id: `recent:${code}`, group: COPY.studio.palette.recent, label: roomName(code), keywords: ["room", "recent", code], icon: Waypoints, run: () => enterRoom(code) })),
    ...places.map((v) => ({ id: `place:${v}`, group: COPY.studio.palette.places, label: NAMES[v]!, hint: v === "contracts" && waiting ? say(COPY.studio.decide.count, { count: waiting }) : undefined, shortcut: KEYS[v], icon: icon[v], run: go(v) })),
    ...rooms.map((r) => ({ id: `room:${r.code}`, group: COPY.studio.palette.rooms, label: r.name, keywords: ["room", r.code], icon: Waypoints, run: () => enterRoom(r.code) })),
    ...codes.filter((code) => spotsFor(code).includes("workshop")).map((code) => ({ id: `workshop:${code}`, group: "Rooms", label: `${domains.nameOf(code)} workshop`, hint: "Work on the chosen design", keywords: ["canvas", "frame"], icon: PenTool, run: () => enterRoom(code, "workshop") })),
    ...codes.filter((code) => spotsFor(code).includes("book")).map((code) => ({ id: `book:${code}`, group: "Rooms", label: `The client's book (${domains.nameOf(code)})`, hint: "Brand, market and how to sell it, per project", keywords: ["book", "brand book", "market report"], icon: BookOpen, run: () => enterRoom(code, "book") })),
    ...(data?.projects.map((p) => ({ id: `project:${p.id}`, group: "Projects", label: p.name, hint: `${label(p.status)} · ${p.domains.map(domains.nameOf).join(", ")}`, keywords: [p.description ?? "", p.objective ?? ""], icon: FolderOpen, run: () => openView("manage", p.id) })) ?? []),
    { id: "do:lighting", group: "Actions", label: day ? "Night lighting" : "Day lighting", icon: Sun, run: () => setLighting(day ? "night" : "day") },
    { id: "do:keys", group: "Actions", label: "Keyboard shortcuts", shortcut: "?", icon: Keyboard, run: () => setKeySheet(true) },
    { id: "do:signout", group: "Actions", label: "Sign out", icon: LogOut, run: () => void signOut() },
  ];

  const status = <><span className="live-dot" /> <span>{waiting ? <><RollingNumber value={waiting} /> {COPY.studio.status.awaiting}</> : COPY.studio.status.clear}</span></>;
  const composer = <Composer onGo={(to) => (to.place === "FLOOR" ? openView("floor") : enterRoom(to.room))} onBrief={() => openView("brief")} onRequests={() => openView("directive")} />;

  return <main className="command-center studio-home">
    <TopBar who="CEO" center={status} date={today} initials={initials} onSettings={() => openView("settings")} onSignOut={signOut} onSearch={() => setPalette(true)} onKeys={() => setKeySheet(true)} />
    <RoomKeys commands={commands} bindings={bindings} palette={palette} setPalette={setPalette} sheet={keySheet} setSheet={setKeySheet}
      notes={[{ title: "At the signing desk", keys: [{ keys: ["J", "K"], label: "Next or previous authorization" }, { keys: ["A"], label: "Approve (then Enter to confirm)" }, { keys: ["R"], label: "Reject (then Enter to confirm)" }] }]} />

    <CursorLight />
    <ThresholdVeil sceneKey={view === "room" ? `room:${dept}` : view === "roomdesk" ? `roomdesk:${dept}:${roomSpot}` : view} dir={dir} origin={origin} />

    {(view === "office" || isDesk(view)) && <SceneFrame sceneKey="office" dir={dir} origin={origin} inert={isDesk(view)}>
      <div className="studio-scene">
        <header className="studio-head">
          <h1>{COPY.studio.scene.heading}</h1>
          {brand.brand?.line && <p className="studio-line">{brand.brand.line}</p>}
        </header>
        {studio.isError && <div className="empty-state"><b>{(studio.error as Error).message}</b></div>}
        {!sv && !studio.isError && <p className="studio-loading"><span className="pulse-dot" /> {COPY.studio.scene.loading}</p>}
        {sv && <div className="studio-layout">
          <DecideCard view={sv} onItem={(d) => openView(deskFor(d, data), d.projectId ?? undefined, undefined, d.id)} onAll={() => openView("contracts")} />
          <StudioBench view={sv} onEnter={(room) => enterRoom(room)} />
          <div className="studio-right">
            <KnowCard view={sv} onOpen={() => openView("brief")} />
            <BoardCard view={sv} onOpen={() => openView("floor")} />
          </div>
        </div>}
        {composer}
      </div>
    </SceneFrame>}

    {(view === "room" || view === "roomdesk") && data && <SceneFrame sceneKey={`room:${dept}`} dir={dir} origin={origin} inert={view === "roomdesk"}>
      <RoomStage data={data} dept={dept} back={() => openView("office")} goTo={(d) => { if (d === dept) return; const order = domainOrder(data, domains.list); setDir(order.indexOf(d) > order.indexOf(dept) ? "next" : "prev"); setOrigin(undefined); setFocusProject(undefined); setDept(d); }} onAct={(spot, at) => { setRoomSpot(spot); setRoomAt(at); openView("roomdesk", undefined, at); }} />
    </SceneFrame>}

    {view === "floor" && <div className="workspace">
      <div className="workspace-heading"><Button variant="ghost" className="back-link" onClick={() => openView("office")}><ArrowLeft size={16} /> {COPY.floor.back}</Button><span className="workspace-path">{brandName && <>{brandName} &nbsp; / &nbsp; </>}{COPY.floor.title}</span></div>
      <SceneFrame sceneKey={view} dir={dir} origin={origin}>
        <h1 className="floor-title">{COPY.floor.title}</h1>
        {floor.isError && <div className="empty-state"><b>{(floor.error as Error).message}</b></div>}
        {!floor.data && !floor.isError && <DeskSkeleton />}
        {floor.data && <FloorSurface view={floor.data} onEngagement={(id) => openView("manage", id)} onRoom={(room, id) => enterRoom(room, undefined, id)} onDetail={() => openView("computer")} onRecords={() => openView("manage")} />}
      </SceneFrame>
      {composer}
    </div>}

    {isDesk(view) && <DeskOverlay account={account} label={NAMES[view] ?? view} backLabel={COPY.floor.back.toUpperCase()} path={<>{brandName && <>{brandName} &nbsp; / &nbsp; </>}{(NAMES[view] ?? view).toUpperCase()}</>} surface={view} origin={origin} onBack={() => openView("office")}>
      {!data ? <DeskSkeleton error={q.isError ? (q.error as Error).message : undefined} /> : <div key={view} className="scene scene-side">
        {view === "computer" && <ComputerView data={data} refresh={refresh} openContracts={(id) => openView("contracts", id)} openBrief={() => openView("brief")} openManage={(id) => openView("manage", id)} />}
        {view === "contracts" && <ContractsView data={data} refresh={refresh} focusProjectId={focusProject} focusApprovalId={focusItem} more={<ContractsDesk data={data} onChanged={refresh} />} />}
        {view === "directive" && <DirectiveView data={data} refresh={refresh} close={() => openView("office")} />}
        {view === "manage" && <ManageView data={data} refresh={refresh} initialProjectId={focusProject} />}
        {view === "settings" && <SettingsView data={data} refresh={refresh} />}
        {view === "brief" && <BriefView data={data} refresh={refresh} openContracts={(id) => openView("contracts", id)} openComputer={() => openView("computer")} />}
      </div>}
    </DeskOverlay>}

    {view === "roomdesk" && <DeskOverlay account={account} label={`${domains.nameOf(dept)} ${roomSpot}`} backLabel="BACK TO ROOM" path={<>{brandName && <>{brandName} &nbsp; / &nbsp; </>}{domains.nameOf(dept).toUpperCase()} &nbsp; / &nbsp; {roomSpot.toUpperCase()}</>} surface={`room-${roomSpot}`} wide={roomSpot === "workshop"} origin={origin} onBack={() => openView("room", undefined, roomAt)}>
      {data ? <div className="scene scene-side"><RoomDesk data={data} dept={dept} spot={roomSpot} openManage={(id) => openView("manage", id)} /></div> : <DeskSkeleton error={q.isError ? (q.error as Error).message : undefined} />}
    </DeskOverlay>}
  </main>;
}
