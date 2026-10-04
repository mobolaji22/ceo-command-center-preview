"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import type { ActionLinkView } from "@/lib/model";

/**
 * The page an emailed link opens. It only describes the question and what answering would do; nothing is answered until the person
 * presses the button. That matters: mail programs and security scanners open links to check them, and a link that answers on
 * opening would be answered by a machine before the person saw it. Works without signing in, and answers only the one question the
 * link is for. Anything about money, rules or risk is answered after signing in, and this page says so.
 */
type Phase = { kind: "loading" } | { kind: "invalid" } | { kind: "unreachable"; message: string } | { kind: "view"; view: ActionLinkView } | { kind: "done"; view: ActionLinkView } | { kind: "gone"; why: "USED" | "EXPIRED" | "ANSWERED" };

const GONE: Record<"USED" | "EXPIRED" | "ANSWERED", { title: string; text: string }> = {
  USED: { title: "This link has already been used", text: "Each link works once. If the work still needs you, it is waiting in your Command Center." },
  EXPIRED: { title: "This link has expired", text: "Links last three days. Sign in to answer from your Command Center." },
  ANSWERED: { title: "This was already answered", text: "Someone has answered this question another way, so there is nothing left to do." },
};

export function ActionLinkCard({ token }: { token: string }) {
  const ds = useDataSource();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void ds.actionLinks.describe(token).then((r) => {
      if (!live) return;
      if (r.data) setPhase(r.data.state === "READY" ? { kind: "view", view: r.data } : { kind: "gone", why: r.data.state });
      else setPhase(r.error?.code === "INVALID_OR_EXPIRED" ? { kind: "invalid" } : { kind: "unreachable", message: r.error?.message ?? "Couldn't open this link." });
    });
    return () => { live = false; };
  }, [ds, token]);

  const confirm = async (view: ActionLinkView) => {
    setBusy(true); setMsg(null);
    const r = await ds.actionLinks.confirm(token);
    setBusy(false);
    if (r.data) { setPhase({ kind: "done", view }); return; }
    const code = r.error?.code;
    if (code === "ALREADY_USED") setPhase({ kind: "gone", why: "USED" });
    else if (code === "EXPIRED") setPhase({ kind: "gone", why: "EXPIRED" });
    else if (code === "ALREADY_ANSWERED") setPhase({ kind: "gone", why: "ANSWERED" });
    else if (code === "INVALID_OR_EXPIRED") setPhase({ kind: "invalid" });
    else setMsg(code === "FORBIDDEN" ? "This can no longer be answered from here. Please sign in." : r.error?.message ?? "That didn't work. Please sign in to answer.");
  };

  return <main className="auth-page"><div className="auth-card action-card">
    <div className="brand"><span className="brand-mark"><span /></span><span>DEVPLAYBOOK <em>/</em> V4</span></div>
    {phase.kind === "loading" && <p className="auth-sub" role="status">Opening…</p>}
    {phase.kind === "invalid" && <><h1>This link isn&apos;t valid<span className="period">.</span></h1><p className="auth-sub">It may be incomplete, or no longer apply to you. Sign in to see what needs you.</p></>}
    {phase.kind === "unreachable" && <><h1>We couldn&apos;t open this<span className="period">.</span></h1><p className="auth-sub" role="alert">{phase.message}</p></>}
    {phase.kind === "gone" && <><h1>{GONE[phase.why].title}<span className="period">.</span></h1><p className="auth-sub">{GONE[phase.why].text}</p></>}
    {phase.kind === "view" && <>
      <div className="eyebrow gold">{phase.view.project ? phase.view.project.toUpperCase() : "YOUR PROJECT"}</div>
      <h1>{phase.view.title}<span className="period">.</span></h1>
      <p className="auth-sub">{phase.view.summary}</p>
      <section className="action-does" aria-label="What happens if you confirm"><b>{phase.view.label}</b><p>{phase.view.does}</p></section>
      <p className="auth-sub">Nothing happens until you confirm. Anything about money, rules or risk needs you signed in.</p>
      {msg && <div className="auth-msg" role="alert">{msg}</div>}
      <Button className="approve-btn" disabled={busy} onClick={() => confirm(phase.view)}>{busy ? "Working…" : `Confirm: ${phase.view.label.toLowerCase()}`}</Button>
    </>}
    {phase.kind === "done" && <><h1>Done<span className="period">.</span></h1><p className="auth-sub" role="status">{phase.view.label}: {phase.view.does} You&apos;ll see it in your Command Center.</p></>}
    <div className="auth-links"><Link href="/auth">Sign in</Link></div>
  </div></main>;
}
