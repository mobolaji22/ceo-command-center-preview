"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lobby, useLobby, VisitorCard } from "@/components/cc/lobby";
import { useDataSource } from "@/lib/data";
import { landingFor } from "@/lib/destination";

/**
 * Landing page for an emailed link. The link only opens this page; signing in needs a click. That matters: mail
 * programs and security scanners often open links to check them, and a single-use link must not be spent by a machine
 * before the person gets to it. It opens in the lobby, like every way in.
 */
export function ConfirmLink({ kind }: { kind: "sign-in" | "invitation" }) {
  return <Lobby><Confirm kind={kind} /></Lobby>;
}

function Confirm({ kind }: { kind: "sign-in" | "invitation" }) {
  const token = useSearchParams().get("token");
  const ds = useDataSource();
  const { leave } = useLobby();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  const go = async () => {
    if (!token) return;
    setBusy(true); setMsg(null);
    const r = kind === "sign-in" ? await ds.auth.verifyLink(token) : await ds.auth.acceptInvitation(token);
    if (r.error || !r.data) { setBusy(false); setMsg(r.error?.message ?? "That link didn't work."); setShake((n) => n + 1); return; }
    const session = r.data;
    leave(landingFor(session));
  };

  return <VisitorCard eyebrow={kind === "sign-in" ? "Your link" : "Invitation"} shake={shake}>
    <h1 className="lobby-title">{kind === "sign-in" ? "Ready when you are" : "You're invited"}<span className="period">.</span></h1>
    {!token
      ? <p className="lobby-sub">This link is incomplete. Open it again from your email, or ask for a new one.</p>
      : <p className="lobby-sub">{kind === "sign-in" ? "Continue to sign in to the Command Center." : "Accept the invitation to join and sign in. You'll have access straight away."}</p>}
    {msg && <div className="auth-msg lobby-msg" role="alert">{msg}</div>}
    {token && <div className="lobby-actions"><Button className="approve-btn lobby-go" disabled={busy} onClick={go}>{kind === "sign-in" ? "Continue" : "Accept invitation"}</Button></div>}
    <div className="lobby-links"><Link href="/auth">Ask for a new link</Link></div>
  </VisitorCard>;
}
