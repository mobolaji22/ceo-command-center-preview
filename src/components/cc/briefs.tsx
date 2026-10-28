"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, CircleAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useDataSource } from "@/lib/data";
import { fmtAgo, fmtDate, label } from "@/lib/format";
import type { BriefDoc, BriefStatement, BriefSummary, BriefType, DigestFrequency, NotificationPrefs, Source } from "@/lib/model";

/**
 * What people are told (CC-5). The archive lists the briefs; opening one shows each statement with the records it comes from a
 * click away, and a button that opens every one of those records again to confirm the statement still says what the record says.
 * What is not known is shown as not recorded, never filled in. Nothing here writes a brief or decides who may read one: the API
 * does, and a client is only ever sent what was written to their own organization.
 */
const KIND: Record<BriefType, string> = { KICKOFF: "WHAT WE WILL DO", PROGRESS: "PROGRESS", EXCEPTION: "NEEDS ATTENTION", DIGEST: "DIGEST", HANDOFF: "HANDOFF", OUTCOME: "OUTCOME", IMPROVEMENT: "WHAT WE LEARNED" };
const tone = (t: BriefType) => (t === "EXCEPTION" ? "amber" : t === "DIGEST" ? "muted" : "green");

const short = (id: string) => (id.length > 10 ? `${id.slice(0, 8)}…` : id);
const value = (v: string | number | null) => (v === null ? "" : typeof v === "number" ? String(v) : v);

/** One source, in words: what record it is, and what it says at the place that was cited. */
export function sourceWords(s: Source): string {
  const what = label(s.type);
  const where = s.path ? ` · ${label(s.path.replace(/\./g, " ").replace(/([a-z])([A-Z])/g, "$1 $2"))}` : "";
  const says = s.expect !== null ? ` = ${value(s.expect)}` : "";
  return s.sum ? `Total of ${s.ids.length} ${what.toLowerCase()} records${where}${says}` : `${what} ${short(s.ids[0] ?? "")}${where}${says}`;
}

function Statement({ s }: { s: BriefStatement }) {
  const [open, setOpen] = useState(false);
  if (s.kind === "GAP") return <p className="brief-statement gap"><span>{s.text}</span><small>Not recorded</small></p>;
  return <div className="brief-statement">
    <p><span>{s.text}</span>
      <Button variant="ghost" className="inline-arrow source-toggle" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} where this comes from: ${s.text}`} onClick={() => setOpen(!open)}>{open ? "HIDE SOURCES" : "SOURCES"}</Button></p>
    {open && <ul className="sources" aria-label="Where this comes from">{s.sources.map((x, i) => <li key={i}>{sourceWords(x)}</li>)}</ul>}
  </div>;
}

/** One brief, in order, with its sources a click away and a check on all of them. */
export function BriefReader({ id }: { id: string }) {
  const ds = useDataSource();
  const q = useQuery({ queryKey: ["brief", id], meta: { static: true }, queryFn: async () => { const r = await ds.briefs.get(id); if (r.error) throw new Error(r.error.message); return r.data!; } });
  const [check, setCheck] = useState<{ ok: boolean; facts: number; gaps: number; problems: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (q.isLoading) return <p className="case-none">Opening…</p>;
  if (q.isError || !q.data) return <p className="case-none">{(q.error as Error | null)?.message ?? "That couldn't be opened."}</p>;
  const brief: BriefDoc = q.data;
  const sections = [...new Set(brief.statements.map((s) => s.section))];
  const verify = async () => {
    setBusy(true); setErr(null);
    const r = await ds.briefs.verify(id);
    setBusy(false);
    if (r.error) setErr(r.error.message); else setCheck(r.data);
  };
  return <article className="brief-reader" aria-label={brief.title}>
    {sections.map((sec) => <section key={sec}>
      <div className="section-label"><span>{sec.toUpperCase()}</span></div>
      {brief.statements.filter((s) => s.section === sec).map((s) => <Statement key={s.position} s={s} />)}
    </section>)}
    <div className="brief-check">
      <Button variant="outline" disabled={busy} onClick={verify}><ShieldCheck size={14} /> {busy ? "Checking…" : "Check every source"}</Button>
      {err && <span role="alert" className="mmsg">{err}</span>}
      {check && (check.ok
        ? <span role="status" className="check-ok"><Check size={14} /> Every statement matches its records ({check.facts} statement{check.facts === 1 ? "" : "s"} checked{check.gaps ? `, ${check.gaps} not recorded` : ""}).</span>
        : <div role="alert" className="check-bad"><CircleAlert size={14} /> {check.problems.length} statement{check.problems.length === 1 ? " does" : "s do"} not match{check.problems.length === 1 ? " its" : " their"} records:<ul>{check.problems.map((p, i) => <li key={i}>{p}</li>)}</ul></div>)}
    </div>
  </article>;
}

/** The archive: every brief the signed-in person may read, newest first, each opening in place. */
export function BriefArchive({ projectId, type, limit }: { projectId?: string; type?: BriefType; limit?: number }) {
  const ds = useDataSource();
  const q = useQuery({ queryKey: ["briefs", projectId ?? "all", type ?? "all"], queryFn: async () => { const r = await ds.briefs.list({ ...(projectId ? { projectId } : {}), ...(type ? { type } : {}) }); if (r.error) throw new Error(r.error.message); return r.data!; } });
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const items: BriefSummary[] = q.data ?? [];
  const shown = limit && !all ? items.slice(0, limit) : items;
  if (q.isLoading) return <p className="case-none">Loading…</p>;
  if (q.isError) return <p className="case-none">{(q.error as Error).message}</p>;
  if (items.length === 0) return <p className="case-none">Nothing has been written yet.</p>;
  return <div className="brief-archive" aria-label="Briefs">
    {shown.map((b) => <div key={b.id} className="resolved-row brief-row">
      <span>{b.title}<small>{fmtDate(b.created_at)} · {fmtAgo(b.created_at)}</small></span>
      <span className="project-room-actions"><span className={`pill ${tone(b.type)}`}>{KIND[b.type]}</span>
        <Button variant="ghost" className="inline-arrow" aria-expanded={open === b.id} aria-label={`${open === b.id ? "Close" : "Read"} ${b.title}`} onClick={() => setOpen(open === b.id ? null : b.id)}>{open === b.id ? "CLOSE" : "READ"}</Button></span>
      {open === b.id && <div className="case-slot"><BriefReader id={b.id} /></div>}
    </div>)}
    {limit && items.length > limit && <Button variant="ghost" className="inline-arrow" onClick={() => setAll(!all)}>{all ? "SHOW RECENT" : `SHOW ALL ${items.length}`}</Button>}
  </div>;
}

/** On the phone: what has been told, and what is waiting for the digest. */
export function PhoneBriefs({ open }: { open: () => void }) {
  const ds = useDataSource();
  const q = useQuery({ queryKey: ["notifications"], queryFn: async () => { const r = await ds.notifications.list(); if (r.error) throw new Error(r.error.message); return r.data!; } });
  const items = q.data ?? [];
  const waiting = items.filter((n) => n.status === "WAITING_DIGEST" || n.status === "QUEUED").length;
  const told = items.filter((n) => n.status === "SENT" || n.status === "DIGESTED").slice(0, 3);
  return <>
    <div className="phone-section-title small-title">Briefs <span>{String(items.length).padStart(2, "0")}</span></div>
    {told.length === 0 ? <div className="phone-info"><Check size={15} /><span>Nothing new<small>{waiting ? `${waiting} waiting for your digest` : "You are up to date"}</small></span></div> :
      told.map((n) => <Button key={n.id} variant="ghost" className="phone-decision" onClick={open}><span>{n.title}<small>{label(n.type)} · {fmtAgo(n.created_at)}</small></span><ArrowRight size={16} /></Button>)}
    {told.length > 0 && waiting > 0 && <div className="phone-info"><Check size={15} /><span>{waiting} more waiting for your digest<small>Collected, not forgotten</small></span></div>}
  </>;
}

const LEVELS: Array<[number, string]> = [[3, "Important and above"], [4, "Urgent and above"], [5, "Only emergencies"]];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const zones = (): string[] => { try { return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone"); } catch { return ["UTC"]; } };

/** How a person wants to be told: quiet hours in their own timezone, how urgent before it interrupts, email, and the digest. */
export function NotificationSettings() {
  const ds = useDataSource();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notification-prefs"], meta: { static: true }, queryFn: async () => { const r = await ds.notifications.preferences(); if (r.error) throw new Error(r.error.message); return r.data!; } });
  const [draft, setDraft] = useState<NotificationPrefs | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (q.isLoading) return <p className="case-none">Loading…</p>;
  if (q.isError || !q.data) return <p className="case-none">{(q.error as Error | null)?.message ?? "Couldn't load your settings."}</p>;
  const p = draft ?? q.data;
  const set = (patch: Partial<NotificationPrefs>) => { setDraft({ ...p, ...patch }); setMsg(null); };
  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await ds.notifications.savePreferences(p);
    setBusy(false);
    if (r.error) { setMsg({ ok: false, text: r.error.message }); return; }
    setDraft(null); await qc.invalidateQueries({ queryKey: ["notification-prefs"] });
    setMsg({ ok: true, text: "Saved." });
  };
  return <form className="notify-settings" aria-label="How you are told" onSubmit={(e) => { e.preventDefault(); void save(); }}>
    <label>Your timezone
      <select aria-label="Your timezone" value={p.timezone} onChange={(e) => set({ timezone: e.target.value })}>{[...new Set([p.timezone, ...zones()])].map((z) => <option key={z}>{z}</option>)}</select></label>
    <label className="inline-check"><input aria-label="Quiet hours" type="checkbox" checked={p.quiet_hours !== null} onChange={(e) => set({ quiet_hours: e.target.checked ? { start: "22:00", end: "07:00" } : null })} /> Quiet hours</label>
    {p.quiet_hours && <div className="pair">
      <label>From<input aria-label="From" type="time" value={p.quiet_hours.start} onChange={(e) => set({ quiet_hours: { start: e.target.value, end: p.quiet_hours!.end } })} /></label>
      <label>Until<input aria-label="Until" type="time" value={p.quiet_hours.end} onChange={(e) => set({ quiet_hours: { start: p.quiet_hours!.start, end: e.target.value } })} /></label>
      <small>Nothing interrupts you then, except an emergency. It is sent when quiet hours end.</small></div>}
    <label>Interrupt me for
      <select aria-label="Interrupt me for" value={p.min_interrupt_level} onChange={(e) => set({ min_interrupt_level: Number(e.target.value) })}>{LEVELS.map(([n, t]) => <option key={n} value={n}>{t}</option>)}</select></label>
    <small>Anything less urgent waits for your digest. Important things cannot be switched off.</small>
    <label className="inline-check"><input aria-label="Send me email" type="checkbox" checked={p.email_enabled} onChange={(e) => set({ email_enabled: e.target.checked })} /> Send me email</label>
    <label>Digest
      <select aria-label="Digest" value={p.digest.frequency} onChange={(e) => set({ digest: { ...p.digest, frequency: e.target.value as DigestFrequency } })}><option value="DAILY">Every day</option><option value="WEEKLY">Every week</option><option value="OFF">Off</option></select></label>
    {p.digest.frequency !== "OFF" && <div className="pair">
      {p.digest.frequency === "WEEKLY" && <label>On<select aria-label="On" value={p.digest.weekday} onChange={(e) => set({ digest: { ...p.digest, weekday: Number(e.target.value) } })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>}
      <label>At<input aria-label="At" type="time" value={p.digest.time} onChange={(e) => set({ digest: { ...p.digest, time: e.target.value } })} /></label></div>}
    <div className="notify-actions"><Button type="submit" disabled={busy || !draft}>{busy ? "Saving…" : "Save"}</Button>{msg && <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "check-ok" : "mmsg"}>{msg.text}</span>}</div>
  </form>;
}

/** One brief on a page of its own: where a link in an email lands, once signed in. */
export function BriefPage({ id }: { id: string }) {
  const ds = useDataSource();
  const auth = useAuth();
  const q = useQuery({ queryKey: ["brief", id], meta: { static: true }, queryFn: async () => { const r = await ds.briefs.get(id); if (r.error) throw new Error(r.error.message); return r.data!; } });
  const home = auth.user?.role === "owner" ? "/" : "/client";
  return <main className="command-center">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><span /></span><span>DEVPLAYBOOK <em>/</em> BRIEF</span></div>
      <div className="topbar-right"><Link href={home} className="inline-arrow">BACK TO THE COMMAND CENTER</Link></div>
    </header>
    <div className="workspace"><div className="client-wrap">
      {q.isLoading && <p className="case-none" role="status">Opening…</p>}
      {q.isError && <div className="empty-state"><b>That brief couldn&apos;t be opened.</b><p>{(q.error as Error).message}</p></div>}
      {q.data && <>
        <div className="eyebrow gold">{KIND[q.data.type]} · {fmtDate(q.data.created_at)}</div>
        <h2 className="manage-title">{q.data.title}<span className="period">.</span></h2>
        <BriefReader id={id} />
      </>}
    </div></div>
  </main>;
}
