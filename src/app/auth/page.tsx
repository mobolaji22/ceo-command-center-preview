"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CodeTiles, Envelope, Lobby, useLobby, VisitorCard } from "@/components/cc/lobby";
import { useDataSource } from "@/lib/data";
import { landingFor } from "@/lib/destination";

/**
 * Passwordless sign-in (ADR-0007). There is no password anywhere in this app: an emailed link, or the six-digit code in
 * the same email, is the whole sign-in. Accounts are created by invitation only, so this page never creates one.
 * It is the lobby: the card is the visitor's, and signing in walks them into the building.
 */
export default function AuthPage() {
  return <Lobby><SignIn /></Lobby>;
}

/** How long the envelope is in the air before the code step shows. Matches lobby-envelope in lobby.css. */
const SEND_MS = 700;

function SignIn() {
  const router = useRouter();
  const ds = useDataSource();
  const { leave, reduced } = useLobby();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);
  const [shake, setShake] = useState(0);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    void ds.auth.getSession().then((s) => { if (s) router.replace(landingFor(s)); });
  }, [ds, router]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault(); setBusy(true); setMsg(null);
    const r = await ds.auth.requestSignIn(email.trim());
    if (r.error) { setBusy(false); setMsg(r.error.message); setShake((n) => n + 1); return; }
    setSent((n) => n + 1);
    window.setTimeout(() => { setBusy(false); setStep("code"); }, step === "code" || reduced ? 0 : SEND_MS);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await ds.auth.verifyCode(email.trim(), code.trim());
    if (r.error || !r.data) { setBusy(false); setMsg(r.error?.message ?? "Sign-in failed."); setShake((n) => n + 1); return; }
    const session = r.data;
    setAccepted(true);
    leave(() => router.replace(landingFor(session)));
  };

  return <VisitorCard eyebrow={step === "email" ? "Visitors" : "Your code"} onSubmit={step === "email" ? send : verify} shake={shake}>
    <h1 key={step} className="lobby-title">{step === "email" ? "Welcome back" : "Check your email"}<span className="period">.</span></h1>
    {step === "email"
      ? <p className="lobby-sub">Enter your email and we&apos;ll send a sign-in link. Clients join by invitation.</p>
      : <p className="lobby-sub">If <b>{email}</b> has access, a link and a six-digit code are on their way. Open the link, or type the code here. Either works once and expires in 15 minutes.</p>}
    {ds.kind === "fixtures" && <p className="lobby-sub lobby-demo">Demo mode: use <b>ceo@example.com</b> (owner) or <b>amara@northwind.example</b> (client), and the code <b>123456</b>.</p>}
    {step === "email"
      ? <label className="lobby-field">EMAIL<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus placeholder="you@company.com" /></label>
      : <label className="lobby-field">SIX-DIGIT CODE<CodeTiles value={code} onChange={setCode} state={accepted ? "accepted" : busy ? "checking" : "idle"} autoFocus /></label>}
    {msg && <div className="auth-msg lobby-msg" role="alert">{msg}</div>}
    <div className="lobby-actions">
      <Button type="submit" className="approve-btn lobby-go" disabled={busy || accepted} data-ready={step === "code" && code.length === 6 ? "" : undefined}>
        {step === "email" ? "Email me a link" : "Sign in"}
      </Button>
      {sent > 0 && <Envelope key={sent} />}
    </div>
    {step === "code" && <div className="lobby-links">
      <button type="button" onClick={() => { setStep("email"); setCode(""); setMsg(null); }}>Use a different email</button>
      <button type="button" onClick={() => void send()} disabled={busy}>Send another</button>
    </div>}
  </VisitorCard>;
}
