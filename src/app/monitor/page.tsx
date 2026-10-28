"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import { fixturePeople, resetFixtures } from "@/lib/data/fixtures";

type Person = ReturnType<typeof fixturePeople>[number];

/**
 * The monitor (demo only): the CEO's office and one client's room side by side, on the same demo records, so a change made on
 * one side can be watched arriving on the other. Each frame is signed in as its own person (`?as=`); the records are shared.
 * Against the real API a session belongs to a browser, so the two views are two browsers; this page says so instead of faking it.
 * Each frame draws a desktop-sized page at three quarters of its size, so the monitor shows the desktop experience, not the phone's.
 */
export default function MonitorPage() {
  const ds = useDataSource();
  // The demo's people never change (only their records do), so they are read once.
  const [people] = useState<Person[]>(() => (ds.kind === "fixtures" ? fixturePeople() : []));
  const [client, setClient] = useState(() => people.find((p) => p.role === "client")?.id ?? "");
  const [round, setRound] = useState(0);

  if (ds.kind !== "fixtures") {
    return <main className="monitor monitor-off"><div><h1>Monitor</h1><p>The monitor runs on demo data. With the live API, a session belongs to one browser: open the CEO&apos;s office in one browser and a client&apos;s room in another (or a private window).</p></div></main>;
  }
  const ceo = people.find((p) => p.role === "owner");
  const clients = people.filter((p) => p.role === "client");
  const reset = () => { resetFixtures(); setRound((n) => n + 1); };

  return <main className="monitor">
    <header className="monitor-bar">
      <span className="monitor-title">MONITOR <em>· demo data, shared by both sides</em></span>
      <label>CLIENT<select aria-label="Client shown" value={client} onChange={(e) => setClient(e.target.value)}>{clients.map((p) => <option key={p.id} value={p.id}>{p.name}{p.organization ? ` · ${p.organization}` : ""}</option>)}</select></label>
      <Button variant="ghost" className="monitor-reset" onClick={reset} title="Put the demo back to how it started"><RotateCcw size={14} /> Reset demo</Button>
    </header>
    <div className="monitor-panes">
      {ceo && <section aria-label="CEO's office"><div className="monitor-label">CEO · {ceo.name}</div><div className="monitor-frame"><iframe key={`ceo:${round}`} title="CEO's office" src={`/?as=${encodeURIComponent(ceo.id)}`} /></div></section>}
      {client && <section aria-label="Client's room"><div className="monitor-label">CLIENT · {clients.find((p) => p.id === client)?.name}</div><div className="monitor-frame"><iframe key={`client:${client}:${round}`} title="Client's room" src={`/client?as=${encodeURIComponent(client)}`} /></div></section>}
    </div>
  </main>;
}
