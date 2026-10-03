"use client";

import { useEffect, useState } from "react";
import { useDataSource } from "./data";
import type { Session } from "./model";

export type AuthState = { user: Session | null; isOwner: boolean; isClient: boolean; loading: boolean };

/** Session state, resolved through the DataSource. Same shape the preview's useAuth exposed. */
export function useAuth(): AuthState {
  const ds = useDataSource();
  const [state, setState] = useState<AuthState>({ user: null, isOwner: false, isClient: false, loading: true });
  useEffect(() => {
    let active = true;
    const load = async () => {
      const user = await ds.auth.getSession();
      if (active) setState({ user, isOwner: user?.role === "owner", isClient: user?.role === "client", loading: false });
    };
    void load();
    const off = ds.auth.subscribe(() => void load());
    return () => { active = false; off(); };
  }, [ds]);
  return state;
}
