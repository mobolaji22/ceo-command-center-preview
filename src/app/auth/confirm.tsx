"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import { landingFor } from "@/lib/destination";

/**
 * Landing page for an emailed link. The link only opens this page; signing in needs a click. That matters: mail
 * programs and security scanners often open links to check them, and a single-use link must not be spent by a machine
 * before the person gets to it.
 */
export function ConfirmLink({ kind }: { kind: "sign-in" | "invitation" }) {
  const token = useSearchParams().get("token");
  const router = useRouter();
  const ds = useDataSource();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const go = async () => {
    if (!token) return;
    setBusy(true); setMsg(null);
    const r = kind === "sign-in" ? await ds.auth.verifyLink(token) : await ds.auth.acceptInvitation(token);
    setBusy(false);
    if (r.error || !r.data) { setMsg(r.error?.message ?? "That link didn't work."); return; }
    router.replace(landingFor(r.data));
  };

  return <main className="auth-page"><div className="auth-card">
    <div className="brand"><span className="brand-mark"><span /></span><span>DEVPLAYBOOK <em>/</em> V4</span></div>
    <h1>{kind === "sign-in" ? "Ready when you are" : "You're invited"}<span className="period">.</span></h1>
    {!token
      ? <p className="auth-sub">This link is incomplete. Open it again from your email, or ask for a new one.</p>
      : <p className="auth-sub">{kind === "sign-in" ? "Continue to sign in to the Command Center." : "Accept the invitation to join and sign in. You'll have access straight away."}</p>}
    {msg && <div className="auth-msg" role="alert">{msg}</div>}
    {token && <Button className="approve-btn" disabled={busy} onClick={go}>{kind === "sign-in" ? "Continue" : "Accept invitation"}</Button>}
    <div className="auth-links"><Link href="/auth">Ask for a new link</Link></div>
  </div></main>;
}
