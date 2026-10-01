import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, Bell, BookOpen, Check,
  ChevronDown, CircleAlert, Clock3, Coffee, DoorOpen, FileCheck2, FileText,
  Fingerprint, LayoutGrid, LockKeyhole, Monitor, MoreHorizontal, PenLine,
  Phone, Radio, Search, Send, ShieldCheck, Sparkles, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import officeImage from "@/assets/ceo-office.jpg";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "CEO Command Center — DevPlaybook" },
    { name: "description", content: "An executive command center for decisions, governance, and organizational intelligence." },
    { property: "og:title", content: "CEO Command Center — DevPlaybook" },
    { property: "og:description", content: "An executive command center for decisions, governance, and organizational intelligence." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

type Hotspot = "focus" | "computer" | "phone" | "contracts" | "directive" | "brief" | "door";
type View = "office" | "computer" | "phone" | "contracts" | "directive" | "brief" | "hallway" | "room";
type ContractTab = "Contract Review" | "Modify Constraints & Scope" | "Request Evidence";

const hotspotData: Record<Hotspot, { title: string; label: string; description: string; action: string; icon: typeof Coffee }> = {
  focus: { title: "EXECUTIVE FOCUS", label: "Atmosphere", description: "Set the tone for a quieter, more deliberate session.", action: "Toggle focus lighting", icon: Coffee },
  computer: { title: "THE OPERATING SYSTEM", label: "Computer", description: "The state of the organization, in one clear view.", action: "Open operating system", icon: Monitor },
  phone: { title: "AGENCY PULSE CHANNEL", label: "Phone", description: "Your executive attention, distilled to what matters.", action: "Open phone", icon: Phone },
  contracts: { title: "GOVERNANCE PROTOCOL", label: "Contracts", description: "A consequential decision is waiting for your signature.", action: "Review contract", icon: FileCheck2 },
  directive: { title: "EXECUTIVE DIRECTIVE", label: "Directive", description: "Frame an intent that the organization can act on.", action: "Compose directive", icon: PenLine },
  brief: { title: "THE CEO BRIEF", label: "Brief", description: "“What happened while I was away?”", action: "Review full brief", icon: Sparkles },
  door: { title: "BEYOND THE OFFICE", label: "Door", description: "Step into the departments behind the decisions.", action: "Enter corridor", icon: DoorOpen },
};

const doors = [
  { number: "01", name: "Strategy", status: "Active", icon: LayoutGrid, details: "Priorities, initiatives, and the long view." },
  { number: "02", name: "Operations", status: "Active", icon: Activity, details: "Execution health across the organization." },
  { number: "03", name: "Finance", status: "Active", icon: Fingerprint, details: "Capital, commitments, and runway." },
  { number: "04", name: "People & Culture", status: "Being fitted out", icon: BookOpen, details: "A new room is taking shape." },
  { number: "05", name: "Intelligence", status: "Being fitted out", icon: Search, details: "A new room is taking shape." },
];

function Index() {
  const [view, setView] = useState<View>("office");
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [focus, setFocus] = useState(false);
  const [computerTab, setComputerTab] = useState("Cases & Engagements");
  const [contractTab, setContractTab] = useState<ContractTab>("Contract Review");
  const [resolution, setResolution] = useState<"approved" | "rejected" | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [directive, setDirective] = useState("");
  const [submittedDirective, setSubmittedDirective] = useState("");
  const [room, setRoom] = useState(doors[0]!);

  const openView = (next: View) => { setActiveHotspot(null); setView(next); };
  const actOnHotspot = (spot: Hotspot) => {
    if (spot === "focus") { setFocus(!focus); setActiveHotspot(null); return; }
    openView(spot === "door" ? "hallway" : spot);
  };

  return <main className={`command-center ${focus ? "focus-mode" : ""}`}>
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><span /></span><span>DEVPLAYBOOK <em>/</em> CEO</span></div>
      <div className="topbar-center"><span className="live-dot" /> SYSTEM ONLINE <span className="topbar-divider" /> PRIVATE EXECUTIVE WORKSPACE</div>
      <div className="topbar-right"><span className="topbar-date">WEDNESDAY · 30 SEPTEMBER 2026</span><span className="avatar">OM</span></div>
    </header>

    {view === "office" && <div className="office-stage">
      <img className="office-image" src={officeImage} width={1920} height={1088} alt="Warmly lit executive office overlooking the city at night" />
      <div className="office-vignette" />
      <div className="scene-intro"><div className="eyebrow"><span className="short-line" /> YOUR PRIVATE WORKSPACE</div><h1>The command center<span className="period">.</span></h1><p>A clearer view of what needs your attention.</p></div>
      <div className="scene-side-label">DPL — 01 <span /> EXECUTIVE OFFICE</div>
      {(["door", "focus", "contracts", "phone", "computer", "directive", "brief"] as Hotspot[]).map((spot) => <Button key={spot} variant="ghost" size="icon" className={`hotspot hotspot-${spot} ${activeHotspot === spot ? "selected" : ""}`} aria-label={`Preview ${hotspotData[spot].label}`} title={hotspotData[spot].label} onClick={() => setActiveHotspot(activeHotspot === spot ? null : spot)}><span className="hotspot-center" /></Button>)}
      {activeHotspot && <div className={`hotspot-preview preview-${activeHotspot}`}>
        <div className="preview-top"><span className="preview-icon">{(() => { const Icon = hotspotData[activeHotspot].icon; return <Icon size={17} />; })()}</span><Button variant="ghost" size="icon" className="icon-button tiny" aria-label="Close preview" onClick={() => setActiveHotspot(null)}><X size={15} /></Button></div>
        <div className="eyebrow gold">{hotspotData[activeHotspot].title}</div>
        <p className="preview-description">{hotspotData[activeHotspot].description}</p>
        <Button variant="ghost" className="text-action" onClick={() => actOnHotspot(activeHotspot)}>{hotspotData[activeHotspot].action} <ArrowRight size={15} /></Button>
      </div>}
      <div className="scene-bottom"><div className="hotspot-status"><span className="pulse-dot" /> HOTSPOTS ACTIVE <span className="status-separator">/</span><span className="status-list">Computer · Phone · Contracts · Directive · Brief · Door</span></div><div className="scene-coordinate">40° 43′ N &nbsp; / &nbsp; 73° 59′ W</div></div>
    </div>}

    {view !== "office" && <div className="workspace">
      <div className="workspace-heading"><Button variant="ghost" className="back-link" onClick={() => openView("office")}><ArrowLeft size={16} /> BACK TO OFFICE</Button><span className="workspace-path">DEVPLAYBOOK &nbsp; / &nbsp; {view === "room" ? room.name.toUpperCase() : view.toUpperCase()}</span><span className="workspace-right"><span className="live-dot" /> LIVE ENVIRONMENT</span></div>

      {view === "computer" && <div className="computer-frame">
        <div className="window-bar"><div className="traffic-dots"><i /><i /><i /></div><span>&gt; DevPlaybook V4 Core Canonical Operating System <span className="window-muted">//</span> State: <strong>Synchronized DPL-01</strong></span><MoreHorizontal size={18} /></div>
        <div className="computer-body"><div className="computer-heading"><div><div className="eyebrow gold">THE ORGANIZATIONAL NERVOUS SYSTEM</div><h2>Operating overview<span className="period">.</span></h2><p>Every signal in its place. Every decision accounted for.</p></div><div className="system-time"><Radio size={15} /> ALL SYSTEMS SYNCHRONIZED</div></div>
          <div className="computer-tabs" role="tablist" aria-label="Operating system sections">{["Cases & Engagements", "Decision Ledger", "Security/Gov"].map(tab => <Button key={tab} role="tab" aria-selected={computerTab === tab} variant="ghost" className={computerTab === tab ? "tab active" : "tab"} onClick={() => setComputerTab(tab)}>{tab}</Button>)}</div>
          {computerTab === "Cases & Engagements" && <div className="computer-content"><div className="section-label"><span>ACTIVE DOSSIERS</span><span>03 IN MOTION</span></div><div className="dossier-list">
            <div className="dossier-row"><span className="row-index">01</span><div><b>Northstar market expansion</b><small>Strategic initiative · Growth</small></div><span className="pill amber">CEO REVIEW</span><Button variant="ghost" size="icon" className="icon-button" aria-label="Review Northstar dossier" onClick={() => openView("contracts")}><ArrowRight size={17} /></Button></div>
            <div className="dossier-row"><span className="row-index">02</span><div><b>Enterprise partnership framework</b><small>Commercial engagement · Partnerships</small></div><span className="pill green">ON TRACK</span><Button variant="ghost" size="icon" className="icon-button" aria-label="Review partnership dossier" onClick={() => openView("contracts")}><ArrowRight size={17} /></Button></div>
            <div className="dossier-row"><span className="row-index">03</span><div><b>Q4 resource allocation</b><small>Operational planning · Finance</small></div><span className="pill muted">IN PROGRESS</span><Button variant="ghost" size="icon" className="icon-button" aria-label="Review allocation dossier" onClick={() => openView("contracts")}><ArrowRight size={17} /></Button></div>
          </div><div className="computer-lower"><div><div className="section-label">SIGNAL HEALTH</div><h3>Steady, with one exception.</h3><p>The system is operating within expected parameters. One decision has been escalated for your review.</p></div><Button variant="ghost" className="inline-arrow" onClick={() => openView("brief")}>VIEW EXECUTIVE BRIEF <ArrowRight size={16} /></Button></div></div>}
          {computerTab === "Decision Ledger" && <div className="computer-content"><div className="section-label"><span>DECISION LEDGER</span><span>TRACEABLE BY DESIGN</span></div><div className="dossier-list"><div className="dossier-row"><span className="row-index">01</span><div><b>Northstar market expansion authorization</b><small>Awaiting CEO signature · Today</small></div><span className="pill amber">PENDING</span><Button variant="ghost" size="icon" className="icon-button" aria-label="Open pending decision" onClick={() => openView("contracts")}><ArrowRight size={17} /></Button></div><div className="dossier-row"><span className="row-index">02</span><div><b>Partnership discovery phase</b><small>Approved · Yesterday</small></div><span className="pill green">RESOLVED</span><Check size={17} /></div></div></div>}
          {computerTab === "Security/Gov" && <div className="computer-content"><div className="section-label"><span>SECURITY & GOVERNANCE</span><span>PROTOCOL ACTIVE</span></div><div className="governance-grid"><div><ShieldCheck size={25} /><h3>Authorization controls</h3><p>Consequential actions require explicit CEO approval.</p><span className="pill green">ENFORCED</span></div><div><LockKeyhole size={25} /><h3>Evidence integrity</h3><p>Every proposal retains its supporting reasoning and trail.</p><span className="pill green">VERIFIED</span></div></div></div>}
        </div></div>}

      {view === "phone" && <div className="phone-layout"><div className="phone-intro"><div className="eyebrow gold">AGENCY PULSE / MOBILE CHANNEL</div><h2>Clarity in<br/><i>your pocket.</i></h2><p>The essentials, wherever the day takes you.</p><div className="phone-intro-rule" /><span>01 &nbsp; / &nbsp; EXECUTIVE ATTENTION</span></div><div className="phone-shell"><div className="phone-hardware"><span className="speaker" /><span className="camera" /></div><div className="phone-screen"><div className="phone-top"><span>9:41</span><span>●●● &nbsp; ▰</span></div><div className="phone-content"><div className="phone-app-head"><span className="phone-app-logo">D/</span><span className="pill amber">● AGENCY PULSE CHANNEL</span></div><div className="phone-greeting">Good evening, Ola.</div><h3>Executive<br/>Attention<span className="period">.</span></h3><div className="phone-meta">WED, 30 SEPTEMBER <span>02 ITEMS NEED YOU</span></div><div className="phone-card brief-card"><div className="phone-card-top"><Sparkles size={16}/><span>DAILY EXECUTIVE BRIEF</span><ArrowRight size={15}/></div><p>What happened while I was away?</p><Button variant="ghost" className="phone-card-link" onClick={() => openView("brief")}>READ YOUR BRIEF <ArrowRight size={14}/></Button></div><div className="phone-section-title">Decisions Requiring<br/>CEO Signature <span>01</span></div><Button variant="ghost" className="phone-decision" onClick={() => openView("contracts")}><span>Northstar expansion authorization<small>Growth · Strategic initiative</small><span className="risk-badges"><em>Low / reversible</em><em>Medium / managed</em></span></span><ArrowRight size={16}/></Button><div className="phone-section-title small-title">Exceptions Detected <span>01</span></div><div className="phone-info"><CircleAlert size={15}/><span>Decision threshold reached<small>Escalated for review · 12 min ago</small></span></div><div className="phone-section-title small-title">Nervous System Activity</div><div className="phone-info"><Activity size={15}/><span>All channels responding<small>Last synchronized just now</small></span></div></div><div className="phone-home" /></div></div></div>}

      {view === "contracts" && <div className="contract-wrap"><div className="protocol-line"><ShieldCheck size={17}/><span>DEVPLAYBOOK GOVERNANCE PROTOCOL <span className="dot-divider">·</span> AUTHORIZATION CONTRACT</span><span className="protocol-id">DPL-AC-0041</span></div><div className="contract-tabs" role="tablist" aria-label="Contract sections">{(["Contract Review", "Modify Constraints & Scope", "Request Evidence"] as ContractTab[]).map(tab => <Button key={tab} role="tab" aria-selected={contractTab === tab} variant="ghost" className={`tab ${contractTab === tab ? "active" : ""}`} onClick={() => setContractTab(tab)}>{tab}</Button>)}</div><div className="contract-body"><div className="classification"><span><LockKeyhole size={15}/> CLASSIFICATION: CONSEQUENTIAL ACTION</span><strong>CEO APPROVAL REQUIRED</strong></div>{contractTab === "Contract Review" && <><div className="contract-columns"><div className="contract-main"><div className="eyebrow gold">01 / PROPOSED ACTION</div><h2>Authorize the Northstar<br/>market expansion<span className="period">.</span></h2><p className="contract-lead">Approve a controlled discovery phase for entry into the Northstar market, within the constraints outlined in this authorization.</p><div className="contract-rule"/><div className="eyebrow gold">02 / ORGANIZATIONAL REASONING</div><p className="reasoning">Market signals indicate a time-sensitive opportunity. The proposed phase limits financial exposure while allowing the team to validate demand, partner readiness, and operational fit before any larger commitment.</p><Button variant="ghost" className="evidence-trigger" onClick={() => setEvidenceOpen(!evidenceOpen)}><FileText size={17}/> Substantiating Evidence Trail <ChevronDown size={16} className={evidenceOpen ? "rotated" : ""}/></Button>{evidenceOpen && <div className="evidence-list"><div><span>01</span> Market opportunity assessment <small>Reviewed · Strategy</small></div><div><span>02</span> Financial exposure model <small>Verified · Finance</small></div><div><span>03</span> Risk and reversibility memo <small>Cleared · Governance</small></div></div>}</div><aside className="contract-aside"><div className="eyebrow">DECISION PROFILE</div><div className="aside-stat"><span>RISK LEVEL</span><strong>Medium / managed</strong></div><div className="aside-stat"><span>REVERSIBILITY</span><strong>High</strong></div><div className="aside-stat"><span>DECISION OWNER</span><strong>Chief Executive Officer</strong></div><div className="aside-stat"><span>RESPONSE WINDOW</span><strong>Within 48 hours</strong></div><div className="aside-note"><ShieldCheck size={17}/> Your decision is recorded in the governance ledger.</div></aside></div><div className="contract-actions"><span>{resolution ? `Decision ${resolution} and recorded in this preview.` : "Review the evidence before resolving this authorization."}</span><div><Button variant="outline" className="reject-btn" onClick={() => setResolution("rejected")}>Reject proposal</Button><Button className="approve-btn" onClick={() => setResolution("approved")}><Check size={16}/> Approve authorization</Button></div></div></>}{contractTab === "Modify Constraints & Scope" && <div className="tab-pane"><div className="eyebrow gold">CONTROL THE BOUNDARIES</div><h2>Shape the scope<span className="period">.</span></h2><p>Specify the limits that must be met before authorization proceeds.</p><textarea aria-label="Constraints and scope" placeholder="e.g. Limit the discovery phase to 60 days and require a financial review before expansion…" /><Button className="approve-btn" onClick={() => setContractTab("Contract Review")}>Save constraints <ArrowRight size={16}/></Button></div>}{contractTab === "Request Evidence" && <div className="tab-pane"><div className="eyebrow gold">ASK FOR CLARITY</div><h2>Request evidence<span className="period">.</span></h2><p>Ask the organization to substantiate a part of this proposal before you decide.</p><textarea aria-label="Evidence request" placeholder="What additional evidence would help you make this decision?"/><Button className="approve-btn" onClick={() => setContractTab("Contract Review")}>Record request <ArrowRight size={16}/></Button></div>}</div></div>}

      {view === "directive" && <div className="directive-wrap"><div className="directive-head"><div><div className="eyebrow gold">INTENT FRAMING / CEO OFFICE</div><h2><span className="brain-symbol">✦</span> Executive Directive</h2></div><Button variant="ghost" size="icon" className="icon-button" aria-label="Close directive" onClick={() => openView("office")}><X size={20}/></Button></div><div className="philosophy"><span>THE PRINCIPLE</span><p>The CEO does not manage tasks. The CEO sets direction, resolves ambiguity, and authorizes consequential action.</p></div><div className="directive-form"><label htmlFor="directive-text">WHAT DIRECTION WOULD YOU LIKE TO SET?</label><textarea id="directive-text" value={directive} onChange={e => setDirective(e.target.value)} placeholder="Describe the outcome you want to create, the tension you want resolved, or the principle you want the organization to follow…"/><div className="suggestions"><span>START WITH</span>{["Clarify our Q4 priorities", "Resolve an open trade-off", "Set a guiding principle"].map(s => <Button key={s} variant="outline" onClick={() => setDirective(s)}>{s} <ArrowDownRight size={13}/></Button>)}</div><div className="directive-footer"><span>{directive.length} characters</span><Button className="approve-btn" disabled={!directive.trim()} onClick={() => { setSubmittedDirective(directive.trim()); setDirective(""); }}>Issue directive <Send size={15}/></Button></div>{submittedDirective && <div className="directive-confirm"><Check size={17}/><span>Directive framed for this preview: “{submittedDirective}”</span></div>}</div></div>}

      {view === "brief" && <div className="brief-wrap"><div className="eyebrow gold"><Sparkles size={15}/> THE CEO BRIEF / 30 SEPTEMBER 2026</div><h2>What happened while<br/><i>I was away?</i></h2><p className="brief-lead">A distilled view of the signals, decisions, and movement that matter now.</p><div className="brief-divider"/><div className="brief-grid"><div className="brief-feature"><span>01 / NEEDS YOUR JUDGMENT</span><h3>Northstar is ready for a decision.</h3><p>The discovery phase is proposed with limited exposure and a clear exit path. Your authorization is the remaining step.</p><Button variant="ghost" className="inline-arrow" onClick={() => openView("contracts")}>REVIEW AUTHORIZATION <ArrowRight size={16}/></Button></div><div className="brief-feature"><span>02 / ORGANIZATIONAL PULSE</span><h3>Momentum is holding.</h3><p>Partnership work is on track. Operational channels are synchronized, with one exception escalated for review.</p><Button variant="ghost" className="inline-arrow" onClick={() => openView("computer")}>OPEN OPERATING SYSTEM <ArrowRight size={16}/></Button></div></div><div className="brief-signoff"><span className="live-dot"/> PREPARED BY DEVPLAYBOOK · EXECUTIVE INTELLIGENCE</div></div>}

      {view === "hallway" && <div className="hallway-wrap"><div className="eyebrow gold">BEYOND THE OFFICE / ORGANIZATIONAL SPACES</div><h2>The corridor<span className="period">.</span></h2><p className="hallway-subtitle">Every room has a purpose. Step inside.</p><div className="door-grid">{doors.map(d => { const Icon = d.icon; return <Button key={d.number} variant="ghost" className={`door-card ${d.status !== "Active" ? "unfitted" : ""}`} onClick={() => { setRoom(d); openView("room"); }}><span className="door-number">{d.number} <MoreHorizontal size={18}/></span><span className="door-icon"><Icon size={28} strokeWidth={1.3}/></span><span className="door-bottom"><span className="door-name">{d.name}</span><span className={`pill ${d.status === "Active" ? "green" : "muted"}`}>{d.status === "Active" ? "● " : ""}{d.status.toUpperCase()}</span></span><span className="door-enter">ENTER ROOM <ArrowRight size={15}/></span></Button>; })}</div></div>}

      {view === "room" && <div className="room-wrap"><Button variant="ghost" className="back-link" onClick={() => openView("hallway")}><ArrowLeft size={16}/> ALL ROOMS</Button><div className="room-number">ROOM / {room.number}</div><div className="eyebrow gold">{room.status === "Active" ? "DEPARTMENT LIVE" : "SPACE IN DEVELOPMENT"}</div><h2>{room.name}<span className="period">.</span></h2><p>{room.details}</p>{room.status === "Active" ? <div className="room-signal"><Activity size={18}/> Department channel active <span>·</span> All signals current</div> : <div className="room-signal"><Clock3 size={18}/> Being fitted out</div>}</div>}
    </div>}
  </main>;
}