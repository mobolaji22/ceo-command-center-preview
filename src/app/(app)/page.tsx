"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Coffee, DoorOpen, FileCheck2, LogOut, Monitor, PenLine, Phone, Settings2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import officeImage from "@/assets/ceo-office.jpg";
import { useAuth } from "@/lib/auth";
import { useDataSource } from "@/lib/data";
const ownerKey = ["owner-data"] as const;
import { attentionCounts, needYou } from "@/lib/attention";
import { BriefView, ComputerView, ContractsView, DirectiveView, PhoneView } from "@/components/cc/views";
import { HallwayView, RoomView } from "@/components/cc/corridor";
import { ManageView } from "@/components/cc/manage";
import { ContractsDesk } from "@/components/cc/runs";


type Hotspot = "focus" | "computer" | "phone" | "contracts" | "directive" | "brief" | "door";
type View = "office" | "computer" | "phone" | "contracts" | "directive" | "brief" | "hallway" | "room" | "manage";

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
  useEffect(() => { if (!auth.loading && auth.user && !auth.isOwner) router.replace("/client"); }, [auth, router]);
  const q = useQuery({ queryKey: ownerKey, queryFn: () => ds.queries.ownerData(), enabled: auth.isOwner });
  const refresh = () => qc.invalidateQueries({ queryKey: ownerKey });
  // The same list the phone and the contracts desk show (one shared request), so each count is what is found by opening it.
  const asked = useQuery({ queryKey: ["questions", "all"], queryFn: async () => { const r = await ds.questions.list(); if (r.error) throw new Error(r.error.message); return r.data!; }, enabled: auth.isOwner });

  const [view, setView] = useState<View>("office");
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [focus, setFocus] = useState(false);
  const [dept, setDept] = useState("");
  const [focusProject, setFocusProject] = useState<string | undefined>();

  const openView = (next: View, projectId?: string) => { setActiveHotspot(null); setFocusProject(projectId); setView(next); };
  const actOnHotspot = (spot: Hotspot) => {
    if (spot === "focus") { setFocus(!focus); setActiveHotspot(null); return; }
    openView(spot === "door" ? "hallway" : spot);
  };
  const signOut = async () => { await qc.cancelQueries(); qc.clear(); await ds.auth.signOut(); router.replace("/auth"); };

  const data = q.data;
  const pending = data?.approvals.filter((a) => a.status === "REQUESTED").length ?? 0;
  const attention = data ? attentionCounts(data, asked.data ?? []) : null;
  const count = (spot: Hotspot) => (attention && (spot === "contracts" || spot === "phone" || spot === "computer" || spot === "directive") ? attention[spot] : 0);
  const initials = (auth.user?.email ?? "OM").slice(0, 2).toUpperCase();
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase().replace(",", " ·");

  return <main className={`command-center ${focus ? "focus-mode" : ""}`}>
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><span /></span><span>DEVPLAYBOOK <em>/</em> CEO</span></div>
      <div className="topbar-center"><span className="live-dot" /> SYSTEM ONLINE <span className="topbar-divider" /> {pending} AWAITING SIGNATURE</div>
      <div className="topbar-right"><span className="topbar-date">{today}</span>
        <Button variant="ghost" size="icon" className="icon-button" aria-label="Manage records and clients" title="Manage" onClick={() => openView("manage")}><Settings2 size={16} /></Button>
        <Button variant="ghost" size="icon" className="icon-button" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut size={16} /></Button>
        <span className="avatar">{initials}</span></div>
    </header>

    {view === "office" && <div className="office-stage">
      <img className="office-image" src={officeImage.src} width={1920} height={1088} alt="Warmly lit executive office overlooking the city at night" />
      <div className="office-vignette" />
      <div className="scene-intro"><div className="eyebrow"><span className="short-line" /> YOUR PRIVATE WORKSPACE</div><h1>The command center<span className="period">.</span></h1><p>{data ? `${data.projects.length} projects · ${pending} awaiting your signature.` : "Synchronizing with the ledger…"}</p></div>
      <div className="scene-side-label">DPL — 01 <span /> EXECUTIVE OFFICE</div>
      {(["door", "focus", "contracts", "phone", "computer", "directive", "brief"] as Hotspot[]).map((spot) => <Button key={spot} variant="ghost" size="icon" className={`hotspot hotspot-${spot} ${activeHotspot === spot ? "selected" : ""}`} aria-label={`Preview ${hotspotData[spot].label}`} aria-describedby={count(spot) > 0 ? `hotspot-note-${spot}` : undefined} title={hotspotData[spot].label} onClick={() => setActiveHotspot(activeHotspot === spot ? null : spot)}><span className="hotspot-center" />
        {count(spot) > 0 && <><span className="hotspot-badge" aria-hidden="true">{count(spot) > 9 ? "9+" : count(spot)}</span><span id={`hotspot-note-${spot}`} className="sr-only">{needYou(count(spot))}</span></>}</Button>)}
      {activeHotspot && <div className={`hotspot-preview preview-${activeHotspot}`}>
        <div className="preview-top"><span className="preview-icon">{(() => { const Icon = hotspotData[activeHotspot].icon; return <Icon size={17} />; })()}</span><Button variant="ghost" size="icon" className="icon-button tiny" aria-label="Close preview" onClick={() => setActiveHotspot(null)}><X size={15} /></Button></div>
        <div className="eyebrow gold">{hotspotData[activeHotspot].title}</div>
        <p className="preview-description">{activeHotspot === "contracts" ? (pending ? `${pending} authorization${pending > 1 ? "s" : ""} awaiting your signature.` : "No authorizations awaiting you.") : hotspotData[activeHotspot].description}</p>
        <Button variant="ghost" className="text-action" disabled={activeHotspot !== "focus" && !data} onClick={() => actOnHotspot(activeHotspot)}>{hotspotData[activeHotspot].action} <ArrowRight size={15} /></Button>
      </div>}
      <div className="scene-bottom"><div className="hotspot-status"><span className="pulse-dot" /> HOTSPOTS ACTIVE <span className="status-separator">/</span><span className="status-list">Computer · Phone · Contracts · Directive · Brief · Door</span></div><div className="scene-coordinate">40° 43′ N &nbsp; / &nbsp; 73° 59′ W</div></div>
    </div>}

    {view !== "office" && <div className="workspace">
      <div className="workspace-heading"><Button variant="ghost" className="back-link" onClick={() => openView("office")}><ArrowLeft size={16} /> BACK TO OFFICE</Button><span className="workspace-path">DEVPLAYBOOK &nbsp; / &nbsp; {view === "room" ? dept.toUpperCase() : view.toUpperCase()}</span><span className="workspace-right"><span className="live-dot" /> LIVE LEDGER</span></div>
      {q.isError && <div className="empty-state"><b>Couldn't load the ledger.</b><p>{(q.error as Error).message}</p></div>}
      {!data && !q.isError && <div className="empty-state"><span className="pulse-dot" /><b>Synchronizing…</b></div>}
      {data && <>
        {view === "computer" && <ComputerView data={data} refresh={refresh} openContracts={(id) => openView("contracts", id)} openBrief={() => openView("brief")} openManage={(id) => openView("manage", id)} />}
        {view === "phone" && <PhoneView data={data} refresh={refresh} openBrief={() => openView("brief")} openContracts={(id) => openView("contracts", id)} />}
        {view === "contracts" && <><ContractsView data={data} refresh={refresh} focusProjectId={focusProject} /><ContractsDesk data={data} onChanged={refresh} /></>}
        {view === "directive" && <DirectiveView data={data} refresh={refresh} close={() => openView("office")} />}
        {view === "brief" && <BriefView data={data} refresh={refresh} openContracts={(id) => openView("contracts", id)} openComputer={() => openView("computer")} />}
        {view === "hallway" && <HallwayView data={data} enter={(d) => { setDept(d); openView("room"); }} openManage={() => openView("manage")} />}
        {view === "room" && <RoomView data={data} dept={dept} back={() => openView("hallway")} openManage={(id) => openView("manage", id)} />}
        {view === "manage" && <ManageView data={data} refresh={refresh} initialProjectId={focusProject} />}
      </>}
    </div>}
  </main>;
}
