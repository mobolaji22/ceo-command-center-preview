"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import type { Session } from "@/lib/model";

const homeFor = (s: Session) => (s.role === "owner" ? "/" : "/client");

export default function AuthPage() {
  const router = useRouter();
  const ds = useDataSource();
  const [mode, setMode] = useState<"in" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void ds.auth.getSession().then((s) => { if (s) router.replace(homeFor(s)); });
  }, [ds, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      if (mode === "in") {
        const r = await ds.auth.signInWithPassword(email, password);
        if (r.error || !r.data) throw new Error(r.error?.message ?? "Sign-in failed.");
        router.replace(homeFor(r.data));
      } else {
        const r = await ds.auth.requestPasswordReset(email, window.location.origin + "/reset-password");
        if (r.error) throw new Error(r.error.message);
        setMsg("If that email has an account, a reset link is on its way.");
      }
    } catch (err) { setMsg(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setBusy(false); }
  };

  return <main className="auth-page">
    <form className="auth-card" onSubmit={submit}>
      <div className="brand"><span className="brand-mark"><span /></span><span>DEVPLAYBOOK <em>/</em> V4</span></div>
      <h1>{mode === "in" ? "Welcome back" : "Reset password"}<span className="period">.</span></h1>
      <p className="auth-sub">Command Center and Client Center access. Clients join by invitation.</p>
      {ds.kind === "fixtures" && <p className="auth-sub">Demo mode: sign in as <b>ceo@example.com</b> (owner) or <b>amara@northwind.example</b> (client) with any password of 8+ characters.</p>}
      <label>EMAIL<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
      {mode !== "forgot" && <label>PASSWORD<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>}
      {msg && <div className="auth-msg">{msg}</div>}
      <Button type="submit" className="approve-btn" disabled={busy}>{mode === "in" ? "Sign in" : "Send reset link"}</Button>
      <div className="auth-links">
        {mode !== "in" && <button type="button" onClick={() => setMode("in")}>Sign in</button>}
        {mode !== "forgot" && <button type="button" onClick={() => setMode("forgot")}>Forgot password</button>}
      </div>
    </form>
  </main>;
}
