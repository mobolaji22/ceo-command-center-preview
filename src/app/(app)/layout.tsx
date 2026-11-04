"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LobbyArrival } from "@/components/cc/lobby-arrival";
import { useAuth } from "@/lib/auth";
import { rememberDestination } from "@/lib/destination";

/** Everything under (app) needs a session. Redirects to /auth when there is none. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!auth.loading && !auth.user) { rememberDestination(window.location.pathname); router.replace("/auth"); }
  }, [auth.loading, auth.user, router]);
  if (auth.loading || !auth.user) return null;
  return <>{children}<LobbyArrival /></>;
}
