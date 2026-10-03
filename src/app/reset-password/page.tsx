"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";

export default function ResetPasswordPage() {
  const router = useRouter();
  const ds = useDataSource();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { void ds.auth.hasRecoverySession().then(setReady); }, [ds]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await ds.auth.setPassword(password);
    if (r.error || !r.data) { setMsg(r.error?.message ?? "Could not save the password."); return; }
    router.replace(r.data.role === "owner" ? "/" : "/client");
  };

  return <main className="auth-page"><form className="auth-card" onSubmit={submit}>
    <div className="brand"><span className="brand-mark"><span /></span><span>DEVPLAYBOOK <em>/</em> V4</span></div>
    <h1>Set your password<span className="period">.</span></h1>
    {ready ? <>
      <p className="auth-sub">Choose a password you'll use to sign in from now on.</p>
      <label>NEW PASSWORD<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
      {msg && <div className="auth-msg">{msg}</div>}
      <Button type="submit" className="approve-btn">Save password</Button>
    </> : <p className="auth-sub">Open this page from the link in your email to continue.</p>}
  </form></main>;
}
