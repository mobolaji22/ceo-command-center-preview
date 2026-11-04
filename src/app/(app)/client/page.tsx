"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coffee, FileCheck2, FolderOpen, Keyboard, Lamp, LogOut, Monitor, NotebookPen, Library as LibraryIcon, PenTool, Settings2, Sun, Table2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useDataSource } from "@/lib/data";
import { needYou } from "@/lib/attention";
import type { SceneDir } from "@/lib/motion";
import { BriefsDesk, DecisionsDesk, LibraryDesk, ProjectsDesk, RequestsDesk } from "@/components/cc/client-desks";
import { CursorLight } from "@/components/cc/cursor-light";
import { OfficeStage } from "@/components/cc/office-stage";
import { CLIENT_ART } from "@/components/cc/room-art";
import { SceneFrame, ThresholdVeil, directionBetween, isOverlayMove, type SceneOrigin } from "@/components/cc/scene";
import { DeskOverlay } from "@/components/cc/desk-overlay";
import { DeskSkeleton } from "@/components/cc/desk-skeleton";
import { ClientDesignDesk } from "@/components/cc/workshop/workshop";
import { AccountMenu, TopBar } from "@/components/cc/top-bar";
import { ClientSettingsView } from "@/components/cc/settings";
import { RoomKeys, type KeyBinding, type PaletteCommand } from "@/components/cc/command-palette";
import { usePlaceFromHistory, writePlace } from "@/lib/place";
import { setLighting, useLighting } from "@/lib/lighting";
import { label } from "@/lib/format";

type Spot = "projects" | "decisions" | "requests" | "library" | "briefs" | "atmosphere";
/** The design has no object in the room: it is reached from a project, a link or ⌘K, and opens wide, as the CEO's Workshop does. */
type View = "office" | Exclude<Spot, "atmosphere"> | "design" | "settings";

const spotData: Record<Spot, { title: string; label: string; description: string; action: string; icon: typeof Coffee }> = {
  projects: { title: "THE WORK, ON THE TABLE", label: "Table", description: "Every project the agency is doing for you, and how it is going.", action: "Open projects", icon: Table2 },
  decisions: { title: "WAITING ON YOU", label: "Screen", description: "What needs your signature, and what we need from you.", action: "Open decisions", icon: Monitor },
  requests: { title: "ASKS, BOTH WAYS", label: "Board", description: "Ask for something new, and answer what the work is asking you.", action: "Open requests", icon: NotebookPen },
  library: { title: "WHAT YOU HAVE, WHAT WE MADE", label: "Shelf", description: "Deliverables shared with you, and the files you keep with us.", action: "Open library", icon: LibraryIcon },
  briefs: { title: "KEPT IN THE LOOP", label: "Lamp", description: "Briefs on what happened, and how you want to hear about it.", action: "Open briefs", icon: Lamp },
  atmosphere: { title: "A QUIETER ROOM", label: "Atmosphere", description: "Set the tone for a quieter, more deliberate session.", action: "Toggle focus lighting", icon: Coffee },
};

const DESKS: readonly View[] = ["projects", "decisions", "requests", "library", "briefs", "design", "settings"];
/** The letter that opens each desk (lib/shortcuts), named for what is behind the object rather than the object. */
const DESK_KEYS: Record<Exclude<View, "office">, string> = { projects: "p", decisions: "d", requests: "r", library: "l", briefs: "b", design: "w", settings: "s" };
const DESK_NAMES: Record<Exclude<View, "office">, string> = { projects: "Projects", decisions: "Decisions", requests: "Requests", library: "Library", briefs: "Briefs", design: "Design", settings: "Settings" };
const DESK_ICONS: Record<Exclude<View, "office">, typeof Coffee> = { projects: Table2, decisions: Monitor, requests: NotebookPen, library: LibraryIcon, briefs: Lamp, design: PenTool, settings: Settings2 };

/** Where each object sits on the room photograph, as the stage percentages the hotspots use (a desk opens out of it and folds back into it). */
const OBJECT_AT: Partial<Record<View, SceneOrigin>> = { projects: { x: 60, y: 65 }, decisions: { x: 94, y: 26 }, requests: { x: 85, y: 37 }, library: { x: 27, y: 36 }, briefs: { x: 32, y: 47 } };

/**
 * Client room. The client stands in a room of their own, built the way the CEO's office is: a photograph with objects to press,
 * hover or focus previews, and a desk behind each object that opens on one layer of the information. A client sees only their own
 * organization's projects and what was shared with them. Nothing here is a new data path; it is the same data reached differently.
 */
export default function ClientCenter() {
  const auth = useAuth();
  const ds = useDataSource();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<View>("office");
  const [focus, setFocus] = useState(false);
  const [dir, setDir] = useState<SceneDir>("forward");
  const [origin, setOrigin] = useState<SceneOrigin | undefined>();
  const [focusProject, setFocusProject] = useState<string | undefined>();
  const [palette, setPalette] = useState(false);
  const [keySheet, setKeySheet] = useState(false);
  const day = useLighting() === "day";

  useEffect(() => { if (!auth.loading && auth.user && auth.isOwner) router.replace("/"); }, [auth, router]);
  const q = useQuery({ queryKey: ["client-data"], queryFn: () => ds.queries.clientData(), enabled: auth.isClient });
  const asked = useQuery({ queryKey: ["questions", "all"], queryFn: async () => { const r = await ds.questions.list(); if (r.error) throw new Error(r.error.message); return r.data!; }, enabled: auth.isClient });
  // The library lives beside the data but loads its own; bumping the tick makes it look again whenever something changed.
  const [tick, setTick] = useState(0);
  const refresh = () => { setTick((t) => t + 1); return qc.invalidateQueries({ queryKey: ["client-data"] }); };
  const signOut = async () => { await qc.cancelQueries(); qc.clear(); await ds.auth.signOut(); router.replace("/auth"); };

  // A decision leaves the list the moment it is sent; the API confirms it behind the scenes, and one it refuses comes back.
  const [sent, setSent] = useState<ReadonlySet<string>>(() => new Set());
  const decide = async (id: string, approved: boolean) => {
    setBusy(id); setMsg(approved ? "Recording your approval…" : "Recording your rejection…");
    setSent((s) => new Set(s).add(id));
    const r = await ds.commands.clientResolveApproval(id, approved, "");
    setBusy(null);
    if (r.error) setSent((s) => { const n = new Set(s); n.delete(id); return n; });
    setMsg(r.error ? r.error.message : approved ? "Approved. Thank you." : "Rejected. Your note has gone to the agency.");
    refresh();
  };

  const CLIENT_DESKS = ["projects", "decisions", "requests", "library", "briefs", "design"];
  const openView = (next: View, projectId?: string) => { setDir(isOverlayMove(view, next, CLIENT_DESKS, "office") || (view !== "office" && next !== "office") ? "none" : directionBetween(view, next)); setOrigin(OBJECT_AT[next === "office" ? view : next]); setFocusProject(projectId); setView(next); };

  // The address bar follows the open desk (lib/place); Back, Forward, a refresh or a link open it again.
  const [restored, setRestored] = useState(false);
  usePlaceFromHistory((p) => {
    const desk = DESKS.find((d) => d === p.desk);
    if (desk) openView(desk, p.project); else if (view !== "office") openView("office");
    setRestored(true);
  });
  useEffect(() => { if (restored) writePlace(view === "office" ? {} : { desk: view, project: focusProject }); }, [restored, view, focusProject]);
  const act = (id: Spot) => { if (id === "atmosphere") setFocus((f) => !f); else openView(id); };

  const data = q.data && sent.size ? { ...q.data, approvals: q.data.approvals.filter((a) => !(a.status === "REQUESTED" && sent.has(a.id))) } : q.data;
  const membership = auth.user?.memberships[0];
  const isOwner = membership?.role === "CLIENT_OWNER";
  const pending = data?.approvals.filter((a) => a.status === "REQUESTED").length ?? 0;
  const outstanding = data?.requirements.filter((r) => r.status !== "RECEIVED").length ?? 0;
  const openQuestions = asked.data?.length ?? 0;
  const counts: Record<Spot, number> = { projects: 0, decisions: pending + outstanding, requests: openQuestions, library: 0, briefs: 0, atmosphere: 0 };
  const note = (id: Spot) => (id === "decisions" ? `${pending} to sign, ${outstanding} to supply` : id === "requests" ? `${needYou(openQuestions)}` : "");
  const sceneKey = view;
  const initials = (auth.user?.email ?? "CL").slice(0, 2).toUpperCase();
  const account = <AccountMenu initials={initials} onSettings={() => openView("settings")} onSignOut={signOut} onSearch={() => setPalette(true)} onKeys={() => setKeySheet(true)} />;

  // The fast lane (components/cc/command-palette), the same as the CEO's: letters for the desks, ⌘K for everywhere.
  const go = (v: View, projectId?: string) => () => { if (data) openView(v, projectId); };
  const desks = DESKS.filter((d): d is Exclude<View, "office"> => d !== "office");
  const bindings: KeyBinding[] = desks.map((d) => ({ key: DESK_KEYS[d], label: DESK_NAMES[d], run: go(d) }));
  const commands: PaletteCommand[] = [
    // What is waiting on you comes first, so ⌘K then Enter opens it.
    ...(data?.approvals.filter((a) => a.status === "REQUESTED").map((a) => ({ id: `approval:${a.id}`, group: "Waiting on you", label: a.title, hint: "Needs your signature", keywords: ["approve", "sign"], icon: FileCheck2, run: go("decisions") })) ?? []),
    ...desks.map((d) => ({ id: `desk:${d}`, group: "Desks", label: DESK_NAMES[d], hint: d === "decisions" && pending + outstanding ? `${pending} to sign · ${outstanding} to supply` : d === "settings" ? undefined : d === "design" ? "See the design, leave feedback, decide" : `The ${spotData[d].label.toLowerCase()}`, shortcut: DESK_KEYS[d], icon: DESK_ICONS[d], run: go(d) })),
    ...(data?.projects.map((p) => ({ id: `project:${p.id}`, group: "Projects", label: p.name, hint: label(p.status), keywords: [p.description ?? "", p.objective ?? ""], icon: FolderOpen, run: go("projects", p.id) })) ?? []),
    { id: "do:lighting", group: "Actions", label: day ? "Night lighting" : "Day lighting", icon: Sun, run: () => setLighting(day ? "night" : "day") },
    { id: "do:focus", group: "Actions", label: focus ? "Leave focus lighting" : "Focus lighting", hint: "A quieter room", icon: Coffee, run: () => setFocus((f) => !f) },
    { id: "do:keys", group: "Actions", label: "Keyboard shortcuts", shortcut: "?", icon: Keyboard, run: () => setKeySheet(true) },
    { id: "do:signout", group: "Actions", label: "Sign out", icon: LogOut, run: () => void signOut() },
  ];

  return <main className={`command-center ${focus ? "focus-mode" : ""}`}>
    <TopBar who="CLIENT" center={<><span className="live-dot" /> {pending} AWAITING YOUR SIGNATURE</>} initials={initials} onSettings={() => openView("settings")} onSignOut={signOut} onSearch={() => setPalette(true)} onKeys={() => setKeySheet(true)} />
    <RoomKeys commands={commands} bindings={bindings} palette={palette} setPalette={setPalette} sheet={keySheet} setSheet={setKeySheet} />

    <CursorLight />
    <ThresholdVeil sceneKey={sceneKey} dir={dir} origin={origin} />

    <SceneFrame sceneKey="office" dir={dir} origin={origin} inert={view !== "office"}>
      <OfficeStage
        art={CLIENT_ART}
        alt="Warmly lit client meeting room with a round table overlooking the city"
        eyebrow="YOUR PRIVATE ROOM"
        heading="The client room"
        line={q.isError ? "Couldn't load your projects." : data ? `${data.projects.length} project${data.projects.length === 1 ? "" : "s"} · ${pending} awaiting your signature.` : "Synchronizing with the ledger…"}
        sideLabel={["DPL — 02", "CLIENT ROOM"]}
        spots={(["projects", "decisions", "requests", "library", "briefs", "atmosphere"] as Spot[]).map((id) => ({ id, ...spotData[id], count: counts[id], countNote: note(id), shortcut: id === "atmosphere" ? undefined : DESK_KEYS[id] }))}
        previewText={(id) => (id === "decisions" ? (pending ? `${pending} authorization${pending > 1 ? "s" : ""} awaiting your signature.` : outstanding ? `${outstanding} thing${outstanding > 1 ? "s" : ""} we need from you.` : "Nothing is waiting on you.") : undefined)}
        actionDisabled={(id) => id !== "atmosphere" && !data}
        onAct={act}
        statusList="Table · Screen · Board · Shelf · Lamp"
        coordinate={<>40° 43′ N &nbsp; / &nbsp; 73° 59′ W</>}
      />
    </SceneFrame>

    {view !== "office" && <DeskOverlay account={account} label={view === "settings" ? "Settings" : view === "design" ? "Design workshop" : `${spotData[view].label} desk`} backLabel="BACK TO ROOM" path={<>DEVPLAYBOOK &nbsp; / &nbsp; CLIENT &nbsp; / &nbsp; {view === "settings" || view === "design" ? view.toUpperCase() : spotData[view].label.toUpperCase()}</>} surface={`client-${view}`} wide={view === "design"} origin={origin} onBack={() => openView("office")}>
      {!data ? <DeskSkeleton error={q.isError ? (q.error as Error).message : undefined} /> : <div key={view} className="scene scene-side">
        {view === "projects" && <ProjectsDesk data={data} isOwner={isOwner} initialProjectId={focusProject} />}
        {view === "decisions" && <DecisionsDesk data={data} isOwner={isOwner} busy={busy} msg={msg} onDecide={decide} />}
        {view === "requests" && <RequestsDesk data={data} isOwner={isOwner} organizationId={membership?.organizationId} refresh={refresh} openQuestions={openQuestions} focusProject={focusProject} />}
        {view === "library" && <LibraryDesk data={data} isOwner={isOwner} organizationId={membership?.organizationId} canWrite={isOwner} tick={tick} />}
        {view === "design" && <ClientDesignDesk data={data} initialProjectId={focusProject} />}
        {view === "briefs" && <BriefsDesk isOwner={isOwner} organizationId={membership?.organizationId} projectIds={data.projects.map((p) => p.id)} />}
        {view === "settings" && <ClientSettingsView isOwner={isOwner} organizationId={membership?.organizationId} projectIds={data.projects.map((p) => p.id)} />}
      </div>}
    </DeskOverlay>}
  </main>;
}
