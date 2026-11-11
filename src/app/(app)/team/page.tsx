"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useDataSource } from "@/lib/data";
import { QuestionsList } from "@/components/cc/runs";

/**
 * A team member's page (v4 ADR-0072): the person steps their job roles cover, each with its guide, what it applies and its log. It is
 * all they see of the agency's work; the CEO's office and a client's room are not theirs.
 */
export default function TeamPage() {
  const auth = useAuth();
  const ds = useDataSource();
  const qc = useQueryClient();
  const router = useRouter();
  useEffect(() => { if (!auth.loading && auth.user && !auth.isStaff) router.replace(auth.isOwner ? "/" : "/client"); }, [auth, router]);
  if (!auth.isStaff) return null;
  const signOut = async () => { await qc.cancelQueries(); qc.clear(); await ds.auth.signOut(); router.replace("/auth"); };
  return <main className="team-page" aria-label="Your steps">
    <div className="team-head"><h2>Your steps</h2><Button variant="ghost" onClick={() => void signOut()}>Sign out</Button></div>
    <p className="settings-lead">The work your roles cover, step by step. Log each step as you go; it is done when every step is.</p>
    <QuestionsList audience="staff" />
  </main>;
}
