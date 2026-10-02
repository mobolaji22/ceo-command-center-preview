import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Sign in — DevPlaybook" },
    { name: "description", content: "Sign in to the DevPlaybook Command Center or Client Center." },
    { property: "og:title", content: "Sign in — DevPlaybook" },
    { property: "og:description", content: "Sign in to the DevPlaybook Command Center or Client Center." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
});

async function homeFor(userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r) => r.role === "owner") ? "/" : "/client";
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) navigate({ to: (await homeFor(data.user.id)) as "/" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      if (mode === "in") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: (await homeFor(data.user.id)) as "/" });
      } else if (mode === "up") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth" } });
        if (error) throw error;
        setMsg("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
        if (error) throw error;
        setMsg("If that email has an account, a reset link is on its way.");
      }
    } catch (err) { setMsg(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setBusy(false); }
  };

  return <main className="auth-page">
    <form className="auth-card" onSubmit={submit}>
      <div className="brand"><span className="brand-mark"><span /></span><span>DEVPLAYBOOK <em>/</em> V4</span></div>
      <h1>{mode === "in" ? "Welcome back" : mode === "up" ? "Create account" : "Reset password"}<span className="period">.</span></h1>
      <p className="auth-sub">{mode === "up" ? "The first account becomes the owner of the Command Center. Clients join by invitation." : "Command Center and Client Center access."}</p>
      <label>EMAIL<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
      {mode !== "forgot" && <label>PASSWORD<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} /></label>}
      {msg && <div className="auth-msg">{msg}</div>}
      <Button type="submit" className="approve-btn" disabled={busy}>{mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Send reset link"}</Button>
      <div className="auth-links">
        {mode !== "in" && <button type="button" onClick={() => setMode("in")}>Sign in</button>}
        {mode !== "up" && <button type="button" onClick={() => setMode("up")}>Create account</button>}
        {mode !== "forgot" && <button type="button" onClick={() => setMode("forgot")}>Forgot password</button>}
      </div>
    </form>
  </main>;
}
