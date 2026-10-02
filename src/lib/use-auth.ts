import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AuthState = { user: User | null; isOwner: boolean; isClient: boolean; loading: boolean };

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, isOwner: false, isClient: false, loading: true });
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) { if (active) setState({ user: null, isOwner: false, isClient: false, loading: false }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const r = (roles ?? []).map((x) => x.role);
      if (active) setState({ user, isOwner: r.includes("owner"), isClient: r.includes("client"), loading: false });
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") load();
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);
  return state;
}
