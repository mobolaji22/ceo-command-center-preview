"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import type { Result } from "@/lib/data/types";
import { fmtAgo, fmtDate } from "@/lib/format";
import { RIGORS, type FeeScope, type FeesView, type OwnerData, type Rigor, type SystemView } from "@/lib/model";
import { NotificationSettings } from "./briefs";
import { Orgs, People } from "./manage";
import { StandingPermission } from "./standing";
import { useStepUp } from "./step-up";

/**
 * The CEO's Settings (P6.21): everything about how the agency runs, in one desk behind the header's settings icon. It shows
 * what v4 holds and sends what the CEO changes; v4 validates, prices and audits (INV-27). Changing money (the fee, a rate, the
 * spending envelope) asks for a fresh emailed code first, and nothing changes until it is right.
 */
type Section = "Pricing" | "Model spend" | "How the agency runs" | "Notifications" | "People and access" | "Your sessions";
const SECTIONS: Section[] = ["Pricing", "Model spend", "How the agency runs", "Notifications", "People and access", "Your sessions"];

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const RIGOR_WORDS: Record<Rigor, string> = { light: "Light", standard: "Standard", strict: "Strict", critical: "Critical" };

export function SettingsView({ data, refresh }: { data: OwnerData; refresh: () => void }) {
  const [section, setSection] = useState<Section>("Pricing");
  return (
    <div className="settings" data-desk="settings">
      <h2 className="settings-title">Settings</h2>
      <div className="settings-body">
        <nav className="settings-nav" role="tablist" aria-orientation="vertical" aria-label="Settings">
          {SECTIONS.map((s) => <button key={s} type="button" role="tab" aria-selected={section === s} className={section === s ? "active" : ""} onClick={() => setSection(s)}>{s}</button>)}
        </nav>
        <div className="settings-pane" role="tabpanel" aria-label={section}>
          {section === "Pricing" && <Pricing data={data} />}
          {section === "Model spend" && <ModelSpend />}
          {section === "How the agency runs" && <System />}
          {section === "Notifications" && <><h3>Notifications</h3><p className="settings-lead">How and when you are told. The same settings are on your phone.</p><NotificationSettings /></>}
          {section === "People and access" && <Access data={data} refresh={refresh} />}
          {section === "Your sessions" && <Sessions />}
        </div>
      </div>
    </div>
  );
}

/** A query against one settings read, refetched after a change. */
function useSetting<T>(key: string, read: () => Promise<Result<T>>) {
  return useQuery({ queryKey: ["settings", key], queryFn: async () => { const r = await read(); if (r.error) throw new Error(r.error.message); return r.data as T; } });
}

/** Runs a change behind the emailed-code check, then refreshes `key` and says what happened. */
function useChange(key: string) {
  const qc = useQueryClient();
  const { guard, panel } = useStepUp();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const change = async (action: () => Promise<Result>, done: string) => {
    setBusy(true); setMsg(null);
    await guard(action, async (r) => {
      setBusy(false);
      if (r.error) { setMsg({ ok: false, text: r.error.message }); return; }
      setMsg({ ok: true, text: done });
      await qc.invalidateQueries({ queryKey: ["settings", key] });
    });
    setBusy(false);
  };
  const note: ReactNode = <>{panel}{msg && <p className={msg.ok ? "mmsg settings-ok" : "mmsg"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}</>;
  return { change, busy, note };
}

function Loading({ q }: { q: { isLoading: boolean; isError: boolean; error: unknown } }) {
  if (q.isLoading) return <p className="case-none">Loading…</p>;
  return <p className="case-none">{(q.error as Error | null)?.message ?? "Couldn't load this."}</p>;
}

function Pricing({ data }: { data: OwnerData }) {
  const ds = useDataSource();
  const q = useSetting<FeesView>("fees", () => ds.settings.fees());
  const { change, busy, note } = useChange("fees");
  if (!q.data) return <Loading q={q} />;
  const fees = q.data;
  const agency = fees.policies.find((p) => p.scope.kind === "agency");
  const overrides = fees.policies.filter((p) => p.scope.kind !== "agency");
  const nameOf = (s: FeeScope) => s.kind === "organization" ? data.organizations.find((o) => o.id === s.id)?.name ?? "A client"
    : s.kind === "project" ? data.projects.find((p) => p.id === s.id)?.name ?? "A project" : "Everyone";
  const defaults = RIGORS.map((rigor) => ({ rigor, rate: fees.rates.find((r) => r.capability === "*" && r.rigor === rigor) }));
  const specific = fees.rates.filter((r) => r.capability !== "*");
  return <>
    <h3>Pricing</h3>
    <p className="settings-lead">What clients pay: the project fee (each piece of work at its rate) plus the agency&apos;s fee, a percentage of the project fee. Plans already sent keep their price; new plans and revisions use these figures.</p>
    {note}

    <section className="settings-block" aria-label="Agency fee">
      <h4>Agency fee</h4>
      <PctForm label="Agency fee for every client" initial={agency?.agency_fee_pct ?? null} busy={busy} submit={(pct) => change(() => ds.settings.setFeePolicy({ agencyFeePct: pct, scope: { kind: "agency" } }), `The agency fee is now ${pct}%.`)} />
      {agency ? <small>Set {fmtDate(agency.updated_at)}.</small> : <small>Not set: until it is, plans carry no price.</small>}
    </section>

    <section className="settings-block" aria-label="Fee for one client or project">
      <h4>For one client or project</h4>
      {overrides.length === 0 ? <p className="settings-none">Every client pays the agency fee.</p> : <ul className="settings-rows">{overrides.map((p) => (
        <li key={`${p.scope.kind}:${"id" in p.scope ? p.scope.id : ""}`}><span><b>{nameOf(p.scope)}</b><small>{p.scope.kind === "organization" ? "Client" : "Project"} · {p.agency_fee_pct}%</small></span>
          <Button variant="ghost" disabled={busy} onClick={() => { if (p.scope.kind !== "agency") { const sc = p.scope; void change(() => ds.settings.clearFeePolicy(sc), `${nameOf(sc)} now pays the agency fee.`); } }}>Remove</Button></li>))}</ul>}
      <OverrideForm data={data} busy={busy} submit={(scope, pct) => change(() => ds.settings.setFeePolicy({ agencyFeePct: pct, scope }), `${nameOf(scope)} now pays ${pct}%.`)} />
    </section>

    <section className="settings-block" aria-label="Rate card">
      <h4>Rate card</h4>
      <p className="settings-lead">What one piece of work costs the client, by how much care it needs.</p>
      <ul className="settings-rows">{defaults.map(({ rigor, rate }) => (
        <li key={rigor}><span><b>{RIGOR_WORDS[rigor]}</b><small>{rate ? `${usd(rate.unit_usd)} each` : "No rate: work at this level has no price"}</small></span>
          <AmountForm label={`${RIGOR_WORDS[rigor]} rate`} initial={rate?.unit_usd ?? null} busy={busy} submit={(n) => change(() => ds.settings.setRate({ capability: "*", rigor, unitUsd: n }), `${RIGOR_WORDS[rigor]} work now costs ${usd(n)}.`)} /></li>))}</ul>
      {specific.length > 0 && <><h5>For one kind of work</h5><ul className="settings-rows">{specific.map((r) => (
        <li key={`${r.capability}:${r.rigor}`}><span><b>{r.capability}</b><small>{RIGOR_WORDS[r.rigor]} · {usd(r.unit_usd)} each</small></span>
          <Button variant="ghost" disabled={busy} onClick={() => void change(() => ds.settings.removeRate({ capability: r.capability, rigor: r.rigor }), `${r.capability} now uses the ${RIGOR_WORDS[r.rigor].toLowerCase()} rate.`)}>Remove</Button></li>))}</ul></>}
      <CapabilityRateForm busy={busy} submit={(capability, rigor, n) => change(() => ds.settings.setRate({ capability, rigor, unitUsd: n }), `${capability} at ${RIGOR_WORDS[rigor].toLowerCase()} now costs ${usd(n)}.`)} />
    </section>
  </>;
}

function PctForm({ label, initial, busy, submit }: { label: string; initial: number | null; busy: boolean; submit: (pct: number) => Promise<void> }) {
  const [v, setV] = useState(initial === null ? "" : String(initial));
  return <form className="settings-inline" onSubmit={(e: FormEvent) => { e.preventDefault(); void submit(Number(v)); }}>
    <label>{label}<span className="settings-unit"><input aria-label={label} type="number" min={0} max={100} step="0.5" required value={v} onChange={(e) => setV(e.target.value)} />%</span></label>
    <Button type="submit" disabled={busy || v === "" || Number(v) === initial}>Save</Button>
  </form>;
}

function AmountForm({ label, initial, busy, submit }: { label: string; initial: number | null; busy: boolean; submit: (n: number) => Promise<void> }) {
  const [v, setV] = useState(initial === null ? "" : String(initial));
  return <form className="settings-inline" onSubmit={(e: FormEvent) => { e.preventDefault(); void submit(Number(v)); }}>
    <span className="settings-unit">$<input aria-label={label} type="number" min={0} step="1" required value={v} onChange={(e) => setV(e.target.value)} /></span>
    <Button type="submit" disabled={busy || v === "" || Number(v) === initial}>Save</Button>
  </form>;
}

function OverrideForm({ data, busy, submit }: { data: OwnerData; busy: boolean; submit: (scope: FeeScope, pct: number) => Promise<void> }) {
  const [target, setTarget] = useState("");
  const [pct, setPct] = useState("");
  const scope = (): FeeScope | null => { const [kind, id] = target.split(":"); return id ? (kind === "org" ? { kind: "organization", id } : { kind: "project", id }) : null; };
  return <form className="settings-inline" onSubmit={(e: FormEvent) => { e.preventDefault(); const s = scope(); if (s) void submit(s, Number(pct)).then(() => { setTarget(""); setPct(""); }); }}>
    <select aria-label="Client or project" required value={target} onChange={(e) => setTarget(e.target.value)}>
      <option value="">Choose a client or project…</option>
      <optgroup label="Clients">{data.organizations.map((o) => <option key={o.id} value={`org:${o.id}`}>{o.name}</option>)}</optgroup>
      <optgroup label="Projects">{data.projects.map((p) => <option key={p.id} value={`project:${p.id}`}>{p.name}</option>)}</optgroup>
    </select>
    <span className="settings-unit"><input aria-label="Their fee" type="number" min={0} max={100} step="0.5" required placeholder="15" value={pct} onChange={(e) => setPct(e.target.value)} />%</span>
    <Button type="submit" disabled={busy || !target || pct === ""}>Set their fee</Button>
  </form>;
}

function CapabilityRateForm({ busy, submit }: { busy: boolean; submit: (capability: string, rigor: Rigor, n: number) => Promise<void> }) {
  const [capability, setCapability] = useState("");
  const [rigor, setRigor] = useState<Rigor>("standard");
  const [n, setN] = useState("");
  return <form className="settings-inline" aria-label="Rate for one kind of work" onSubmit={(e: FormEvent) => { e.preventDefault(); void submit(capability.trim(), rigor, Number(n)).then(() => { setCapability(""); setN(""); }); }}>
    <input aria-label="Kind of work" required maxLength={60} placeholder="Kind of work, e.g. identity-design" value={capability} onChange={(e) => setCapability(e.target.value)} />
    <select aria-label="Care" value={rigor} onChange={(e) => setRigor(e.target.value as Rigor)}>{RIGORS.map((r) => <option key={r} value={r}>{RIGOR_WORDS[r]}</option>)}</select>
    <span className="settings-unit">$<input aria-label="Its rate" type="number" min={0} step="1" required value={n} onChange={(e) => setN(e.target.value)} /></span>
    <Button type="submit" disabled={busy || !capability.trim() || n === ""}>Add rate</Button>
  </form>;
}

function ModelSpend() {
  const ds = useDataSource();
  const q = useSetting("spend", () => ds.settings.spend());
  const { change, busy, note } = useChange("spend");
  const [monthly, setMonthly] = useState<string | null>(null);
  const [perCall, setPerCall] = useState<string | null>(null);
  if (!q.data) return <Loading q={q} />;
  const s = q.data;
  const m = monthly ?? String(s.monthly_ceiling_usd);
  const c = perCall ?? String(s.per_call_ceiling_usd);
  return <>
    <h3>Model spend</h3>
    <p className="settings-lead">What the agency lets paid models spend each month. Until it is set, no paid model runs: a live agency waits instead, and tells you why.</p>
    {note}
    <dl className="settings-facts">
      <div><dt>This month</dt><dd>{usd(s.spent_usd)} spent{s.reserved_usd ? `, ${usd(s.reserved_usd)} held for calls in progress` : ""}</dd></div>
      <div><dt>Left</dt><dd>{s.enforced ? usd(s.remaining_usd) : "No envelope set"}</dd></div>
      <div><dt>Calls</dt><dd>{s.calls} made{s.refused ? `, ${s.refused} refused at the ceiling` : ""}</dd></div>
    </dl>
    <form className="settings-form" aria-label="Spending envelope" onSubmit={(e: FormEvent) => { e.preventDefault(); void change(() => ds.settings.setSpendPolicy({ monthlyCeilingUsd: Number(m), perCallCeilingUsd: Number(c) }), "The envelope is set.").then(() => { setMonthly(null); setPerCall(null); }); }}>
      <label>Each month, at most<span className="settings-unit">$<input aria-label="Monthly ceiling" type="number" min={0} step="1" required value={m} onChange={(e) => setMonthly(e.target.value)} /></span></label>
      <label>One call, at most<span className="settings-unit">$<input aria-label="Per-call ceiling" type="number" min={0} step="0.01" required value={c} onChange={(e) => setPerCall(e.target.value)} /></span></label>
      <Button type="submit" disabled={busy || (monthly === null && perCall === null)}>Save the envelope</Button>
    </form>
  </>;
}

const WAIT_WORDS: Record<SystemView["waiting"][number]["reason"], string> = {
  NO_ENVELOPE: "no spending envelope is set",
  CEILING_REACHED: "this month's envelope is used up",
  PROVIDER_UNAVAILABLE: "no model is switched on, or it is not answering",
  ANSWER_UNUSABLE: "the model's answer could not be used, even after a repair",
};

function System() {
  const ds = useDataSource();
  const q = useSetting("system", () => ds.settings.system());
  if (!q.data) return <Loading q={q} />;
  const s = q.data;
  const waiting = s.waiting.reduce((n, w) => n + w.count, 0);
  return <>
    <h3>How the agency runs</h3>
    <dl className="settings-facts">
      <div><dt>Mode</dt><dd><b>{s.agency_mode === "LIVE" ? "Live" : "Demo"}</b><small>{s.agency_mode === "LIVE"
        ? "A model reads each request and writes each plan. When it cannot, the request waits and you are told why; nothing falls back to the demo."
        : "Requests are read with keywords and plans come from templates. For demonstrations and testing, not for clients' real work."}</small></dd></div>
      <div><dt>Model</dt><dd>{s.model_switched_on ? "Switched on" : "Not switched on"}</dd></div>
      <div><dt>Waiting on reasoning</dt><dd>{waiting === 0 && s.revisions_waiting === 0 ? "Nothing" : <ul className="settings-waits">
        {s.waiting.map((w) => <li key={`${w.step}:${w.reason}`}>{w.count} {w.step === "PLAN" ? `plan${w.count === 1 ? "" : "s"} to write` : `request${w.count === 1 ? "" : "s"} to read`}: {WAIT_WORDS[w.reason]}</li>)}
        {s.revisions_waiting > 0 && <li>{s.revisions_waiting} revision{s.revisions_waiting === 1 ? "" : "s"} being written</li>}</ul>}</dd></div>
    </dl>
    <p className="settings-none">The mode is chosen when the agency is deployed; it is not changed from here.</p>
  </>;
}

function Access({ data, refresh }: { data: OwnerData; refresh: () => void }) {
  const [tab, setTab] = useState<"Organizations" | "People">("Organizations");
  return <>
    <h3>People and access</h3>
    <p className="settings-lead">Your clients, and who in each of them can sign in.</p>
    <div className="settings-tabs" role="tablist" aria-label="People and access">
      {(["Organizations", "People"] as const).map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}
    </div>
    {tab === "Organizations" ? <Orgs data={data} refresh={refresh} /> : <People data={data} refresh={refresh} />}
  </>;
}

const device = (ua: string | null) => !ua ? "A browser" : /iPhone|Android.*Mobile/.test(ua) ? "A phone" : /iPad|Tablet/.test(ua) ? "A tablet" : "A computer";

function Sessions() {
  const ds = useDataSource();
  const qc = useQueryClient();
  const q = useSetting("sessions", () => ds.settings.sessions());
  const [msg, setMsg] = useState<string | null>(null);
  if (!q.data) return <Loading q={q} />;
  const end = async (ids: string[]) => {
    setMsg(null);
    for (const id of ids) { const r = await ds.settings.endSession(id); if (r.error) { setMsg(r.error.message); break; } }
    await qc.invalidateQueries({ queryKey: ["settings", "sessions"] });
  };
  const others = q.data.filter((s) => !s.current);
  return <>
    <h3>Your sessions</h3>
    <p className="settings-lead">Where you are signed in. Sign out anywhere you do not recognise.</p>
    {msg && <p className="mmsg" role="alert">{msg}</p>}
    <ul className="settings-rows">{q.data.map((s) => (
      <li key={s.id}><span><b>{device(s.user_agent)}{s.current ? " · this one" : ""}</b><small>Signed in {fmtDate(s.created_at)} · last used {fmtAgo(s.last_seen_at)}</small></span>
        {!s.current && <Button variant="ghost" onClick={() => void end([s.id])}>Sign out</Button>}</li>))}</ul>
    {others.length > 1 && <Button variant="outline" onClick={() => void end(others.map((s) => s.id))}>Sign out the others</Button>}
  </>;
}

/**
 * A client's Settings (P6.21 D4): how they are told, the permission they have given the agency (each part can be taken back), and
 * where they are signed in. No pricing and nothing about other organizations. The same forms as on their lamp's desk.
 */
type ClientSection = "Notifications" | "Permissions you have given" | "Your sessions";
export function ClientSettingsView({ isOwner, organizationId, projectIds }: { isOwner: boolean; organizationId: string | undefined; projectIds: string[] }) {
  const sections: ClientSection[] = isOwner && organizationId ? ["Notifications", "Permissions you have given", "Your sessions"] : ["Notifications", "Your sessions"];
  const [section, setSection] = useState<ClientSection>("Notifications");
  return (
    <div className="settings" data-desk="settings">
      <h2 className="settings-title">Settings</h2>
      <div className="settings-body">
        <nav className="settings-nav" role="tablist" aria-orientation="vertical" aria-label="Settings">
          {sections.map((s) => <button key={s} type="button" role="tab" aria-selected={section === s} className={section === s ? "active" : ""} onClick={() => setSection(s)}>{s}</button>)}
        </nav>
        <div className="settings-pane" role="tabpanel" aria-label={section}>
          {section === "Notifications" && <><h3>Notifications</h3><p className="settings-lead">How and when the agency tells you things.</p><NotificationSettings /></>}
          {section === "Permissions you have given" && organizationId && <><h3>Permissions you have given</h3><p className="settings-lead">What the agency may do for you without asking first. You can take any of it back.</p><StandingPermission organizationId={organizationId} projectIds={projectIds} /></>}
          {section === "Your sessions" && <Sessions />}
        </div>
      </div>
    </div>
  );
}
