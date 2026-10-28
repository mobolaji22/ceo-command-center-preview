"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Coffee, DoorOpen, FileCheck2, FolderOpen, Keyboard, LogOut, Monitor, PenLine, PenTool, Phone, Settings2, Sparkles, Sun, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useDataSource } from "@/lib/data";
const ownerKey = ["owner-data"] as const;
import { attentionCounts, needYou } from "@/lib/attention";
import { BriefView, ComputerView, ContractsView, DirectiveView, PhoneView } from "@/components/cc/views";
import { HallwayView, departments } from "@/components/cc/corridor";
import { useDomains } from "@/lib/domains";
import { RoomDesk, RoomStage, spotsFor, type RoomSpot } from "@/components/cc/room-stage";
import { SceneFrame, ThresholdVeil, directionBetween, isOverlayMove, originFor, type SceneOrigin } from "@/components/cc/scene";
import { DeskOverlay } from "@/components/cc/desk-overlay";
import { DeskSkeleton, DoorsSkeleton } from "@/components/cc/desk-skeleton";
import { SettingsView } from "@/components/cc/settings";
import { AccountMenu, TopBar } from "@/components/cc/top-bar";
import type { SceneDir } from "@/lib/motion";
import { CursorLight } from "@/components/cc/cursor-light";
import { OfficeStage } from "@/components/cc/office-stage";
import { OFFICE_ART } from "@/components/cc/room-art";
import { ManageView } from "@/components/cc/manage";
import { ContractsDesk } from "@/components/cc/runs";
import { RoomKeys, type KeyBinding, type PaletteCommand } from "@/components/cc/command-palette";
import { usePlaceFromHistory, writePlace, type Place } from "@/lib/place";
import { setLighting, useLighting } from "@/lib/lighting";
import { label } from "@/lib/format";


const CEO_DESKS = ["computer", "phone", "contracts", "directive", "brief", "manage", "settings"] as const;
const isDesk = (v: string): boolean => (CEO_DESKS as readonly string[]).includes(v);

type Hotspot = "focus" | "computer" | "phone" | "contracts" | "directive" | "brief" | "door";
type View = "office" | "computer" | "phone" | "contracts" | "directive" | "brief" | "hallway" | "room" | "roomdesk" | "manage" | "settings";

/** The letter that opens each desk (lib/shortcuts). The same letters label the palette's entries and the hotspots' previews. */
const DESK_KEYS: Partial<Record<View, string>> = { computer: "o", phone: "p", contracts: "c", directive: "d", brief: "b", hallway: "h", manage: "r", settings: "s" };
const DESK_NAMES: Partial<Record<View, string>> = { computer: "Operating system", phone: "Phone", contracts: "Contracts", directive: "Directive", brief: "Brief", hallway: "The corridor", manage: "Records explorer", settings: "Settings" };
const ROOM_SPOTS: readonly RoomSpot[] = ["wall", "calendar", "desk", "workshop"];

/** Where you are, as the address bar says it (lib/place). The records explorer is "records" there; the code calls it manage. */
function placeOf(view: View, dept: string, spot: RoomSpot, project: string | undefined, item: string | undefined): Place {
  if (isDesk(view)) return { desk: view === "manage" ? "records" : view, project, item };
  if (view === "hallway") return { at: "corridor" };
  if (view === "room") return { room: dept };
  if (view === "roomdesk") return { room: dept, spot };
  return {};
}

const hotspotData: Record<Hotspot, { title: string; label: string; description: string; action: string; icon: typeof Coffee }> = {
  focus: { title: "EXECUTIVE FOCUS", label: "Atmosphere", description: "Set the tone for a quieter, more deliberate session.", action: "Toggle focus lighting", icon: Coffee },
  computer: { title: "THE OPERATING SYSTEM", label: "Computer", description: "The state of the organization, in one clear view.", action: "Open operating system", icon: Monitor },
  phone: { title: "AGENCY PULSE CHANNEL", label: "Phone", description: "Your executive attention, distilled to what matters.", action: "Open phone", icon: Phone },
  contracts: { title: "GOVERNANCE PROTOCOL", label: "Contracts", description: "Authorizations awaiting your signature.", action: "Review contracts", icon: FileCheck2 },
  directive: { title: "EXECUTIVE DIRECTIVE", label: "Directive", description: "Frame an intent that the organization can act on.", action: "Compose directive", icon: PenLine },
  brief: { title: "THE CEO BRIEF", label: "Brief", description: "“What happened while I was away?”", action: "Review full brief", icon: Sparkles },
  door: { title: "BEYOND THE OFFICE", label: "Door", description: "Step into the departments behind the decisions.", action: "Enter corridor", icon: DoorOpen },
};

export default function Index() {
  const auth = useAuth();
  const router = useRouter();
  const ds = useDataSource();
  const qc = useQueryClient();
  const domains = useDomains();
  useEffect(() => { if (!auth.loading && auth.user && !auth.isOwner) router.replace("/client"); }, [auth, router]);
  const q = useQuery({ queryKey: ownerKey, queryFn: () => ds.queries.ownerData(), enabled: auth.isOwner });
  const refresh = () => qc.invalidateQueries({ queryKey: ownerKey });
  // The same list the phone and the contracts desk show (one shared request), so each count is what is found by opening it.
  const asked = useQuery({ queryKey: ["questions", "all"], queryFn: async () => { const r = await ds.questions.list(); if (r.error) throw new Error(r.error.message); return r.data!; }, enabled: auth.isOwner });

  const [view, setView] = useState<View>("office");
  const [focus, setFocus] = useState(false);
  const [dept, setDept] = useState("");
  // Which object in a department room was pressed, and where it sits, so its desk opens out of it and folds back into it.
  const [roomSpot, setRoomSpot] = useState<RoomSpot>("wall");
  const [roomAt, setRoomAt] = useState<SceneOrigin | undefined>();
  const [focusProject, setFocusProject] = useState<string | undefined>();
  // One authorization to open on, when the palette chose it (the contracts desk otherwise opens on the first).
  const [focusItem, setFocusItem] = useState<string | undefined>();
  const [palette, setPalette] = useState(false);
  const [keySheet, setKeySheet] = useState(false);
  const day = useLighting() === "day";
  // Which way the last screen change travelled. It only decides how the next screen arrives; nothing else reads it.
  const [dir, setDir] = useState<SceneDir>("none");
  const [origin, setOrigin] = useState<SceneOrigin | undefined>();

  // A desk opens over its room (the room stays mounted behind it), so moving between a room and its desks is not a change of scene.
  const overlay = (next: View) => isOverlayMove(view, next, CEO_DESKS, "office") || isOverlayMove(view, next, ["roomdesk"], "room") || (isDesk(view) && isDesk(next));
  const openView = (next: View, projectId?: string, at?: SceneOrigin, itemId?: string) => { setDir(overlay(next) ? "none" : directionBetween(view, next)); setOrigin(at ?? originFor(view, next)); setFocusProject(projectId); setFocusItem(itemId); setView(next); };
  const enterRoom = (d: string, spot?: RoomSpot) => { setDept(d); if (spot) { setRoomSpot(spot); setRoomAt(undefined); openView("roomdesk"); } else openView("room"); };

  // The address bar follows where you are, and Back, Forward, a refresh or a link put you there (lib/place). Nothing is written
  // until the address has been read once, so arriving on a link does not first overwrite it with the office.
  const [restored, setRestored] = useState(false);
  usePlaceFromHistory((p) => {
    const desk = p.desk === "records" ? "manage" : p.desk;
    const spot = ROOM_SPOTS.find((s) => s === p.spot);
    if (desk && isDesk(desk)) openView(desk as View, p.project, undefined, p.item);
    else if (p.at === "corridor") openView("hallway");
    else if (p.room && /^[A-Z_]+$/.test(p.room)) enterRoom(p.room, spot && spotsFor(p.room).includes(spot) ? spot : undefined);
    else if (view !== "office") openView("office");
    setRestored(true);
  });
  useEffect(() => { if (restored) writePlace(placeOf(view, dept, roomSpot, focusProject, focusItem)); }, [restored, view, dept, roomSpot, focusProject, focusItem]);
  // A room named in a link that the agency does not have goes to the corridor instead (adjusted during render, not in an effect).
  if ((view === "room" || view === "roomdesk") && domains.list.length > 0 && !domains.list.some((d) => d.code === dept)) setView("hallway");
  // The rooms visited this visit, latest first, so the palette can offer them before all thirteen.
  const [recentRooms, setRecentRooms] = useState<string[]>([]);
  if ((view === "room" || view === "roomdesk") && dept && recentRooms[0] !== dept) setRecentRooms([dept, ...recentRooms.filter((d) => d !== dept)].slice(0, 3));
  const actOnHotspot = (spot: Hotspot) => {
    if (spot === "focus") { setFocus(!focus); return; }
    openView(spot === "door" ? "hallway" : spot);
  };
  const signOut = async () => { await qc.cancelQueries(); qc.clear(); await ds.auth.signOut(); router.replace("/auth"); };

  const data = q.data;
  const pending = data?.approvals.filter((a) => a.status === "REQUESTED").length ?? 0;
  const attention = data ? attentionCounts(data, asked.data ?? []) : null;
  const count = (spot: Hotspot) => (attention && (spot === "contracts" || spot === "phone" || spot === "computer" || spot === "directive") ? attention[spot] : 0);
  const initials = (auth.user?.email ?? "OM").slice(0, 2).toUpperCase();
  const account = <AccountMenu initials={initials} onSettings={() => openView("settings")} onSignOut={signOut} onSearch={() => setPalette(true)} onKeys={() => setKeySheet(true)} />;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase().replace(",", " ·");

  // The fast lane (components/cc/command-palette): letters for the desks, and ⌘K for everywhere, built from what is on screen.
  const deskViews = ["computer", "phone", "contracts", "directive", "brief", "hallway", "manage", "settings"] as const;
  const go = (v: View) => () => { if (v === "hallway" || data) openView(v); };
  const bindings: KeyBinding[] = deskViews.map((v) => ({ key: DESK_KEYS[v]!, label: DESK_NAMES[v]!, run: go(v) }));
  const deskIcon: Partial<Record<View, typeof Coffee>> = { computer: Monitor, phone: Phone, contracts: FileCheck2, directive: PenLine, brief: Sparkles, hallway: DoorOpen, manage: FolderOpen, settings: Settings2 };
  const rooms = data ? departments(data, domains.list) : [];
  const commands: PaletteCommand[] = [
    // What is waiting on you comes first, so ⌘K then Enter opens the first decision.
    ...(data?.approvals.filter((a) => a.status === "REQUESTED").map((a) => ({ id: `approval:${a.id}`, group: "Waiting on you", label: a.title, hint: `${data.projects.find((p) => p.id === a.project_id)?.name ?? ""} · authorization`, keywords: ["approve", "sign", "contract"], icon: FileCheck2, run: () => openView("contracts", a.project_id ?? undefined, undefined, a.id) })) ?? []),
    ...recentRooms.filter((code) => rooms.includes(code) && !(view === "room" && code === dept)).map((code) => ({ id: `recent:${code}`, group: "Recent rooms", label: domains.nameOf(code), hint: domains.list.find((d) => d.code === code)?.department.name, keywords: ["room", "recent", code], icon: Waypoints, run: () => enterRoom(code) })),
    ...deskViews.map((v) => ({ id: `desk:${v}`, group: "Desks", label: DESK_NAMES[v]!, hint: v === "contracts" && pending ? `${pending} awaiting your signature` : v === "hallway" ? "Every room of the agency" : undefined, shortcut: DESK_KEYS[v], icon: deskIcon[v], run: go(v) })),
    ...rooms.map((code) => ({ id: `room:${code}`, group: "Rooms", label: domains.nameOf(code), hint: domains.list.find((d) => d.code === code)?.department.name, keywords: ["room", code], icon: Waypoints, run: () => enterRoom(code) })),
    ...rooms.filter((code) => spotsFor(code).includes("workshop")).map((code) => ({ id: `workshop:${code}`, group: "Rooms", label: `${domains.nameOf(code)} workshop`, hint: "Work on the chosen design", keywords: ["canvas", "frame"], icon: PenTool, run: () => enterRoom(code, "workshop") })),
    ...(data?.projects.map((p) => ({ id: `project:${p.id}`, group: "Projects", label: p.name, hint: `${label(p.status)} · ${p.domains.map(domains.nameOf).join(", ")}`, keywords: [p.description ?? "", p.objective ?? ""], icon: FolderOpen, run: () => openView("manage", p.id) })) ?? []),
    { id: "do:lighting", group: "Actions", label: day ? "Night lighting" : "Day lighting", icon: Sun, run: () => setLighting(day ? "night" : "day") },
    { id: "do:focus", group: "Actions", label: focus ? "Leave focus lighting" : "Focus lighting", hint: "A quieter office", icon: Coffee, run: () => setFocus((f) => !f) },
    { id: "do:keys", group: "Actions", label: "Keyboard shortcuts", shortcut: "?", icon: Keyboard, run: () => setKeySheet(true) },
    { id: "do:signout", group: "Actions", label: "Sign out", icon: LogOut, run: () => void signOut() },
  ];

  return <main className={`command-center ${focus ? "focus-mode" : ""}`}>
    <TopBar who="CEO" center={<><span className="live-dot" /> SYSTEM ONLINE <span className="topbar-divider" /> {pending} AWAITING SIGNATURE</>} date={today} initials={initials} onSettings={() => openView("settings")} onSignOut={signOut} onSearch={() => setPalette(true)} onKeys={() => setKeySheet(true)} />
    <RoomKeys commands={commands} bindings={bindings} palette={palette} setPalette={setPalette} sheet={keySheet} setSheet={setKeySheet}
      notes={[{ title: "In Contracts", keys: [{ keys: ["J", "K"], label: "Next or previous authorization" }, { keys: ["A"], label: "Approve (then Enter to confirm)" }, { keys: ["R"], label: "Reject (then Enter to confirm)" }] }]} />

    <CursorLight />

    <ThresholdVeil sceneKey={view === "room" ? `room:${dept}` : view === "roomdesk" ? `roomdesk:${dept}:${roomSpot}` : view} dir={dir} origin={origin} />

    {(view === "office" || isDesk(view)) && <SceneFrame sceneKey="office" dir={dir} origin={origin} inert={isDesk(view)}>
      <OfficeStage
        art={OFFICE_ART}
        alt="Warmly lit executive office overlooking the city"
        eyebrow="YOUR PRIVATE WORKSPACE"
        heading="The command center"
        line={data ? `${data.projects.length} projects · ${pending} awaiting your signature.` : "Synchronizing with the ledger…"}
        sideLabel={["DPL — 01", "EXECUTIVE OFFICE"]}
        spots={(["door", "focus", "contracts", "phone", "computer", "directive", "brief"] as Hotspot[]).map((id) => ({ id, ...hotspotData[id], count: count(id), countNote: needYou(count(id)), shortcut: DESK_KEYS[id === "door" ? "hallway" : id as View] }))}
        previewText={(id) => (id === "contracts" ? (pending ? `${pending} authorization${pending > 1 ? "s" : ""} awaiting your signature.` : "No authorizations awaiting you.") : undefined)}
        actionDisabled={(id) => id !== "focus" && !data}
        onAct={actOnHotspot}
        statusList="Computer · Phone · Contracts · Directive · Brief · Door"
        coordinate={<>40° 43′ N &nbsp; / &nbsp; 73° 59′ W</>}
      />
    </SceneFrame>}

    {(view === "room" || view === "roomdesk") && data && <SceneFrame sceneKey={`room:${dept}`} dir={dir} origin={origin} inert={view === "roomdesk"}>
      <RoomStage data={data} dept={dept} back={() => openView("hallway")} toOffice={() => openView("office")} goTo={(d) => { if (d === dept) return; const order = departments(data, domains.list); setDir(order.indexOf(d) > order.indexOf(dept) ? "next" : "prev"); setOrigin(undefined); setFocusProject(undefined); setDept(d); }} onAct={(spot, at) => { setRoomSpot(spot); setRoomAt(at); openView("roomdesk", undefined, at); }} />
    </SceneFrame>}

    {view === "hallway" && <div className="workspace">
      <div className="workspace-heading"><Button variant="ghost" className="back-link" onClick={() => openView("office")}><ArrowLeft size={16} /> BACK TO OFFICE</Button><span key={view} className="workspace-path">DEVPLAYBOOK &nbsp; / &nbsp; {view.toUpperCase()}</span><span className="workspace-right"><span className="live-dot" /> LIVE LEDGER</span></div>
      <SceneFrame sceneKey={view} dir={dir} origin={origin}>
      {q.isError && <div className="empty-state"><b>Couldn't load the ledger.</b><p>{(q.error as Error).message}</p></div>}
      {!data && !q.isError && <DoorsSkeleton />}
      {data && <>
        {view === "hallway" && <HallwayView data={data} startAt={dept || undefined} enter={(d) => { setDept(d); openView("room"); }} openManage={() => openView("manage")} />}
      </>}
      </SceneFrame>
    </div>}

    {isDesk(view) && <DeskOverlay account={account} label={view === "manage" ? "Records explorer" : view === "settings" ? "Settings" : `${view} desk`} backLabel="BACK TO OFFICE" path={<>DEVPLAYBOOK &nbsp; / &nbsp; {view === "manage" ? "RECORDS" : view.toUpperCase()}</>} surface={view} origin={origin} onBack={() => openView("office")}>
      {!data ? <DeskSkeleton error={q.isError ? (q.error as Error).message : undefined} /> : <div key={view} className="scene scene-side">
        {view === "computer" && <ComputerView data={data} refresh={refresh} openContracts={(id) => openView("contracts", id)} openBrief={() => openView("brief")} openManage={(id) => openView("manage", id)} />}
        {view === "phone" && <PhoneView data={data} refresh={refresh} openBrief={() => openView("brief")} openContracts={(id) => openView("contracts", id)} />}
        {view === "contracts" && <ContractsView data={data} refresh={refresh} focusProjectId={focusProject} focusApprovalId={focusItem} more={<ContractsDesk data={data} onChanged={refresh} />} />}
        {view === "directive" && <DirectiveView data={data} refresh={refresh} close={() => openView("office")} />}
        {view === "manage" && <ManageView data={data} refresh={refresh} initialProjectId={focusProject} />}
        {view === "settings" && <SettingsView data={data} refresh={refresh} />}
        {view === "brief" && <BriefView data={data} refresh={refresh} openContracts={(id) => openView("contracts", id)} openComputer={() => openView("computer")} />}
      </div>}
    </DeskOverlay>}

    {view === "roomdesk" && <DeskOverlay account={account} label={`${domains.nameOf(dept)} ${roomSpot}`} backLabel="BACK TO ROOM" path={<>DEVPLAYBOOK &nbsp; / &nbsp; {domains.nameOf(dept).toUpperCase()} &nbsp; / &nbsp; {roomSpot.toUpperCase()}</>} surface={`room-${roomSpot}`} wide={roomSpot === "workshop"} origin={origin} onBack={() => openView("room", undefined, roomAt)}>
      {data ? <div className="scene scene-side"><RoomDesk data={data} dept={dept} spot={roomSpot} openManage={(id) => openView("manage", id)} /></div> : <DeskSkeleton error={q.isError ? (q.error as Error).message : undefined} />}
    </DeskOverlay>}
  </main>;
}
