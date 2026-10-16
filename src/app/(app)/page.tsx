"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Coffee, DoorOpen, FileCheck2, Monitor, PenLine, Phone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useDataSource } from "@/lib/data";
const ownerKey = ["owner-data"] as const;
import { attentionCounts, needYou } from "@/lib/attention";
import { BriefView, ComputerView, ContractsView, DirectiveView, PhoneView } from "@/components/cc/views";
import { HallwayView, departments } from "@/components/cc/corridor";
import { useDomains } from "@/lib/domains";
import { RoomDesk, RoomStage, type RoomSpot } from "@/components/cc/room-stage";
import { SceneFrame, ThresholdVeil, directionBetween, isOverlayMove, originFor, type SceneOrigin } from "@/components/cc/scene";
import { DeskOverlay } from "@/components/cc/desk-overlay";
import { SettingsView } from "@/components/cc/settings";
import { AccountMenu, TopBar } from "@/components/cc/top-bar";
import type { SceneDir } from "@/lib/motion";
import { CursorLight } from "@/components/cc/cursor-light";
import { OfficeStage } from "@/components/cc/office-stage";
import { OFFICE_ART } from "@/components/cc/room-art";
import { ManageView } from "@/components/cc/manage";
import { ContractsDesk } from "@/components/cc/runs";


const CEO_DESKS = ["computer", "phone", "contracts", "directive", "brief", "manage", "settings"] as const;
const isDesk = (v: string): boolean => (CEO_DESKS as readonly string[]).includes(v);

type Hotspot = "focus" | "computer" | "phone" | "contracts" | "directive" | "brief" | "door";
type View = "office" | "computer" | "phone" | "contracts" | "directive" | "brief" | "hallway" | "room" | "roomdesk" | "manage" | "settings";

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
  // Which way the last screen change travelled. It only decides how the next screen arrives; nothing else reads it.
  const [dir, setDir] = useState<SceneDir>("none");
  const [origin, setOrigin] = useState<SceneOrigin | undefined>();

  // A desk opens over its room (the room stays mounted behind it), so moving between a room and its desks is not a change of scene.
  const overlay = (next: View) => isOverlayMove(view, next, CEO_DESKS, "office") || isOverlayMove(view, next, ["roomdesk"], "room") || (isDesk(view) && isDesk(next));
  const openView = (next: View, projectId?: string, at?: SceneOrigin) => { setDir(overlay(next) ? "none" : directionBetween(view, next)); setOrigin(at ?? originFor(view, next)); setFocusProject(projectId); setView(next); };
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
  const account = <AccountMenu initials={initials} onSettings={() => openView("settings")} onSignOut={signOut} />;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase().replace(",", " ·");

  return <main className={`command-center ${focus ? "focus-mode" : ""}`}>
    <TopBar who="CEO" center={<><span className="live-dot" /> SYSTEM ONLINE <span className="topbar-divider" /> {pending} AWAITING SIGNATURE</>} date={today} initials={initials} onSettings={() => openView("settings")} onSignOut={signOut} />

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
        spots={(["door", "focus", "contracts", "phone", "computer", "directive", "brief"] as Hotspot[]).map((id) => ({ id, ...hotspotData[id], count: count(id), countNote: needYou(count(id)) }))}
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
      {!data && !q.isError && <div className="empty-state"><span className="pulse-dot" /><b>Synchronizing…</b></div>}
      {data && <>
        {view === "hallway" && <HallwayView data={data} startAt={dept || undefined} enter={(d) => { setDept(d); openView("room"); }} openManage={() => openView("manage")} />}
      </>}
      </SceneFrame>
    </div>}

    {isDesk(view) && data && <DeskOverlay account={account} label={view === "manage" ? "Records explorer" : view === "settings" ? "Settings" : `${view} desk`} backLabel="BACK TO OFFICE" path={<>DEVPLAYBOOK &nbsp; / &nbsp; {view === "manage" ? "RECORDS" : view.toUpperCase()}</>} surface={view} origin={origin} onBack={() => openView("office")}>
      <div key={view} className="scene scene-side">
        {view === "computer" && <ComputerView data={data} refresh={refresh} openContracts={(id) => openView("contracts", id)} openBrief={() => openView("brief")} openManage={(id) => openView("manage", id)} />}
        {view === "phone" && <PhoneView data={data} refresh={refresh} openBrief={() => openView("brief")} openContracts={(id) => openView("contracts", id)} />}
        {view === "contracts" && <><ContractsView data={data} refresh={refresh} focusProjectId={focusProject} /><ContractsDesk data={data} onChanged={refresh} /></>}
        {view === "directive" && <DirectiveView data={data} refresh={refresh} close={() => openView("office")} />}
        {view === "manage" && <ManageView data={data} refresh={refresh} initialProjectId={focusProject} />}
        {view === "settings" && <SettingsView data={data} refresh={refresh} />}
        {view === "brief" && <BriefView data={data} refresh={refresh} openContracts={(id) => openView("contracts", id)} openComputer={() => openView("computer")} />}
      </div>
    </DeskOverlay>}

    {view === "roomdesk" && data && <DeskOverlay account={account} label={`${domains.nameOf(dept)} ${roomSpot}`} backLabel="BACK TO ROOM" path={<>DEVPLAYBOOK &nbsp; / &nbsp; {domains.nameOf(dept).toUpperCase()} &nbsp; / &nbsp; {roomSpot.toUpperCase()}</>} surface={`room-${roomSpot}`} wide={roomSpot === "workshop"} origin={origin} onBack={() => openView("room", undefined, roomAt)}>
      <div className="scene scene-side"><RoomDesk data={data} dept={dept} spot={roomSpot} openManage={(id) => openView("manage", id)} /></div>
    </DeskOverlay>}
  </main>;
}
