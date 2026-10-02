import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Set your password — DevPlaybook" },
    { name: "description", content: "Choose a password for your DevPlaybook account." },
    { property: "og:title", content: "Set your password — DevPlaybook" },
    { property: "og:description", content: "Choose a password for your DevPlaybook account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => { if (session) setReady(true); });
    supabase.auth.getSession().then(({ data: s }) => { if (s.session) setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setMsg(error.message); return; }
    const { data } = await supabase.auth.getUser();
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user!.id);
    navigate({ to: (roles ?? []).some((r) => r.role === "owner") ? "/" : "/client" });
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
