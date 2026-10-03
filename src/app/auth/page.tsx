"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import type { Session } from "@/lib/model";

export const homeFor = (s: Session) => (s.role === "owner" ? "/" : "/client");

/**
 * Passwordless sign-in (ADR-0007). There is no password anywhere in this app: an emailed link, or the six-digit code in
 * the same email, is the whole sign-in. Accounts are created by invitation only, so this page never creates one.
 */
export default function AuthPage() {
  const router = useRouter();
  const ds = useDataSource();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void ds.auth.getSession().then((s) => { if (s) router.replace(homeFor(s)); });
  }, [ds, router]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await ds.auth.requestSignIn(email.trim());
    setBusy(false);
    if (r.error) { setMsg(r.error.message); return; }
    setStep("code");
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await ds.auth.verifyCode(email.trim(), code.trim());
    setBusy(false);
    if (r.error || !r.data) { setMsg(r.error?.message ?? "Sign-in failed."); return; }
    router.replace(homeFor(r.data));
  };

  return <main className="auth-page">
    <form className="auth-card" onSubmit={step === "email" ? send : verify}>
      <div className="brand"><span className="brand-mark"><span /></span><span>DEVPLAYBOOK <em>/</em> V4</span></div>
      <h1>{step === "email" ? "Welcome back" : "Check your email"}<span className="period">.</span></h1>
      {step === "email"
        ? <p className="auth-sub">Enter your email and we&apos;ll send a sign-in link. Clients join by invitation.</p>
        : <p className="auth-sub">If <b>{email}</b> has access, a link and a six-digit code are on their way. Open the link, or type the code here. Either works once and expires in 15 minutes.</p>}
      {ds.kind === "fixtures" && <p className="auth-sub">Demo mode: use <b>ceo@example.com</b> (owner) or <b>amara@northwind.example</b> (client), and the code <b>123456</b>.</p>}
      {step === "email"
        ? <label>EMAIL<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus /></label>
        : <label>SIX-DIGIT CODE<input inputMode="numeric" pattern="[0-9]{6}" required value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" autoFocus /></label>}
      {msg && <div className="auth-msg" role="alert">{msg}</div>}
      <Button type="submit" className="approve-btn" disabled={busy}>{step === "email" ? "Email me a link" : "Sign in"}</Button>
      {step === "code" && <div className="auth-links"><button type="button" onClick={() => { setStep("email"); setCode(""); setMsg(null); }}>Use a different email</button><button type="button" onClick={send}>Send another</button></div>}
    </form>
  </main>;
}
