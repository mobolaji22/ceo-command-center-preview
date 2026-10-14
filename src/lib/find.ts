"use client";

import { useMemo, useState } from "react";
import { label } from "@/lib/format";
import type { Project } from "@/lib/model";

/**
 * Finding a project among many. One small hook so every list of projects (the explorer, the computer's dossiers, a department's
 * wall, the client's table) searches and filters the same way: words typed are matched against the name, description, objective,
 * status and departments (every word must be found, in any order); chips narrow by status; a department narrows by where the
 * project is worked; sort orders what is left. Nothing here reaches a server: it works on the projects already on screen.
 */
export type Sort = "new" | "old" | "az";
export type FindOption = { id: string; label: string; count: number };

export function useProjectFind<P extends Pick<Project, "name" | "description" | "objective" | "status" | "domains" | "created_at">>(projects: P[], deptLabel: (code: string) => string) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dept, setDept] = useState("ALL");
  const [sort, setSort] = useState<Sort>("new");

  const statusOptions = useMemo<FindOption[]>(() => {
    const counts = new Map<string, number>();
    projects.forEach((p) => counts.set(p.status, (counts.get(p.status) ?? 0) + 1));
    return [{ id: "ALL", label: "All", count: projects.length }, ...[...counts.entries()].map(([id, count]) => ({ id, label: label(id), count }))];
  }, [projects]);

  const deptOptions = useMemo<FindOption[]>(() => {
    const counts = new Map<string, number>();
    projects.forEach((p) => new Set(p.domains).forEach((d) => counts.set(d, (counts.get(d) ?? 0) + 1)));
    return [{ id: "ALL", label: "All departments", count: projects.length }, ...[...counts.entries()].map(([id, count]) => ({ id, label: deptLabel(id), count })).sort((a, b) => a.label.localeCompare(b.label))];
  }, [projects, deptLabel]);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = projects.filter((p) => {
      if (status !== "ALL" && p.status !== status) return false;
      if (dept !== "ALL" && !p.domains.includes(dept)) return false;
      if (!words.length) return true;
      const hay = [p.name, p.description, p.objective, label(p.status), ...p.domains.map(deptLabel)].filter(Boolean).join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    return [...list].sort((a, b) => (sort === "az" ? a.name.localeCompare(b.name) : sort === "old" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)));
  }, [projects, q, status, dept, sort, deptLabel]);

  const filtering = q.trim() !== "" || status !== "ALL" || dept !== "ALL";
  const clear = () => { setQ(""); setStatus("ALL"); setDept("ALL"); };
  return { q, setQ, status, setStatus, dept, setDept, sort, setSort, results, statusOptions, deptOptions, filtering, clear, total: projects.length };
}
export type ProjectFind<P extends Pick<Project, "name" | "description" | "objective" | "status" | "domains" | "created_at">> = ReturnType<typeof useProjectFind<P>>;

/** Words typed, for highlighting where they matched. */
export const queryWords = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);
