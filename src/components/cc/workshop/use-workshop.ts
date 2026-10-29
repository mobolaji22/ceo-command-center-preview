"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDataSource } from "@/lib/data";
import { applyOp, type Op } from "@/lib/design/edit";
import type { AnnotationKind, AnnotationTarget, SddAnnotation, SddDocument, SddView } from "@/lib/design/v4";

export type SaveState = "saved" | "saving" | "unsaved" | "failed" | "conflict";
type Hist = { past: SddDocument[]; present: SddDocument; future: SddDocument[] };

const LIMIT = 100;

/** The design without its feedback, keys in one order, so two copies of the same design compare equal however they were built. */
function designOf(d: SddDocument): string {
  const sort = (v: unknown): unknown => (Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sort(x)])) : v);
  return JSON.stringify(sort({ ...d, annotations: [], revision: 0, status: "" }));
}

/**
 * The Workshop's state over v4's design document (ADR-0051 decision 5): the revision being worked on, an undo stack of whole
 * documents kept on this device, and autosave into v4's one draft. Autosave keeps the work; it is never an approval, and only the
 * agency's saves are accepted. Feedback is not in the undo stack: it is v4's record, appended and answered through its own calls,
 * so undoing an edit never takes feedback back and a save always carries the feedback as v4 last returned it.
 */
export function useWorkshop(projectId: string, agency: boolean) {
  const ds = useDataSource();
  const [view, setView] = useState<SddView | null>(null);
  const [hist, setHist] = useState<Hist | null>(null);
  const [notes, setNotes] = useState<SddAnnotation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveNote, setSaveNote] = useState("");
  const histRef = useRef<Hist | null>(null);
  const notesRef = useRef<SddAnnotation[]>([]);
  // The draft's hash as v4 last answered it (null: there is no draft, and the first save starts one), and what was saved under it.
  const hashRef = useRef<string | null>(null);
  const savedRef = useRef<SddDocument | null>(null);
  const timer = useRef(0);
  const saving = useRef<Promise<void> | null>(null);
  const coalesce = useRef<{ key: string; at: number } | null>(null);

  const put = (h: Hist | null) => { histRef.current = h; setHist(h); };
  const putNotes = (a: SddAnnotation[]) => { notesRef.current = a; setNotes(a); };

  const adopt = useCallback((v: SddView) => {
    setView(v);
    const doc = v.current?.document ?? v.approved?.document ?? null;
    hashRef.current = v.current?.status === "DRAFT" ? v.current.documentHash : null;
    savedRef.current = doc;
    putNotes(v.annotations);
    put(doc ? { past: [], present: doc, future: [] } : null);
    setSaveState("saved"); setSaveNote("");
  }, []);

  const read = useCallback(async () => {
    const r = await ds.design.read(projectId);
    if (r.error || !r.data) { setLoadError(r.error?.message ?? "The design could not be read."); return null; }
    return r.data;
  }, [ds, projectId]);

  // State is set only once v4 answers. Switching project remounts the Workshop, so a first read needs no reset.
  const fetchView = useCallback(async () => { const v = await read(); if (v) adopt(v); }, [read, adopt]);
  const reload = useCallback(() => { setLoadError(null); return fetchView(); }, [fetchView]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after v4 answers, not synchronously: a read on mount
  useEffect(() => { void fetchView(); }, [fetchView]);

  // The agency edits the draft; a revision waiting for a decision is frozen; a client reads and leaves feedback.
  const editable = agency && !!view && view.current?.status !== "SUBMITTED";
  const dirty = () => !!histRef.current && histRef.current.present !== savedRef.current;

  const persist = useCallback(async (): Promise<void> => {
    if (saving.current) { await saving.current; if (!dirty()) return; }
    const h = histRef.current;
    if (!h || h.present === savedRef.current) return;
    const run = (async () => {
      setSaveState("saving");
      const doc = { ...h.present, annotations: notesRef.current };
      let r = await ds.design.save(projectId, doc, hashRef.current);
      if (r.error?.code === "DRAFT_CONFLICT") {
        // Someone added or answered feedback since the last save: when the design itself is as this editor last saved it, take the
        // new hash and feedback and save again. A design someone else changed is theirs to reconcile, so that one is reported.
        const v = await read();
        const theirs = v?.current?.status === "DRAFT" ? v.current : null;
        if (v && theirs && savedRef.current && designOf(theirs.document) === designOf(savedRef.current)) {
          hashRef.current = theirs.documentHash; putNotes(v.annotations); setView(v);
          r = await ds.design.save(projectId, { ...h.present, annotations: v.annotations }, hashRef.current);
        }
      }
      if (r.error || !r.data) {
        setSaveState(r.error?.code === "DRAFT_CONFLICT" || r.error?.code === "STALE_BASE" ? "conflict" : "failed");
        setSaveNote(r.error?.message ?? "The design could not be saved.");
        return;
      }
      hashRef.current = r.data.documentHash;
      savedRef.current = h.present;
      setSaveNote("");
      setSaveState(histRef.current && histRef.current.present !== h.present ? "unsaved" : "saved");
    })();
    saving.current = run;
    try { await run; } finally { saving.current = null; }
  }, [ds, projectId, read]);

  // Autosave shortly after the last change, and once more when the Workshop closes.
  const present = hist?.present;
  useEffect(() => {
    if (!present || present === savedRef.current) return;
    setSaveState((s) => (s === "conflict" ? s : "unsaved"));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void persist(); }, 700);
    return () => window.clearTimeout(timer.current);
  }, [present, persist]);
  useEffect(() => () => { window.clearTimeout(timer.current); if (dirty()) void persist(); }, [persist]);

  /** Returns a message when the change was refused (a locked element, say), otherwise null. */
  const commit = useCallback((op: Op, opts?: { coalesce?: string }): string | null => {
    const h = histRef.current;
    if (!h || !editable) return null;
    const res = applyOp(h.present, op);
    if (res.error) return res.error;
    if (res.doc === h.present) return null;
    const now = Date.now();
    // The same kind of edit made again straight away (a nudge, a slider) is one step in the history, not twenty.
    const merge = !!opts?.coalesce && coalesce.current?.key === opts.coalesce && now - coalesce.current.at < 900;
    coalesce.current = opts?.coalesce ? { key: opts.coalesce, at: now } : null;
    put(merge ? { past: h.past, present: res.doc, future: [] } : { past: [...h.past, h.present].slice(-LIMIT), present: res.doc, future: [] });
    return null;
  }, [editable]);

  const step = useCallback((dir: "undo" | "redo") => {
    const h = histRef.current;
    if (!h || !editable) return;
    const from = dir === "undo" ? h.past : h.future;
    const target = from[from.length - 1];
    if (!target) return;
    coalesce.current = null;
    put(dir === "undo" ? { past: h.past.slice(0, -1), present: target, future: [...h.future, h.present] } : { past: [...h.past, h.present], present: target, future: h.future.slice(0, -1) });
  }, [editable]);

  /** Feedback goes on the revision as saved, so what is on the screen is saved first; v4 then returns the draft's new hash. */
  const annotate = useCallback(async (target: AnnotationTarget, kind: AnnotationKind, text: string) => {
    await persist();
    const hadDraft = hashRef.current !== null;
    const r = await ds.design.annotate(projectId, { target, kind, text });
    if (r.error || !r.data) return r.error?.message ?? "The feedback could not be added.";
    // A first note starts a draft from the approved revision; read it, so the editor works on that draft from now on.
    if (!hadDraft) { const v = await read(); if (v) adopt(v); return null; }
    hashRef.current = r.data.documentHash;
    putNotes([...notesRef.current, r.data.annotation]);
    return null;
  }, [ds, projectId, persist, read, adopt]);

  const settle = useCallback(async (annotationId: string, status: "ADDRESSED" | "DECLINED", reason?: string) => {
    await persist();
    const hadDraft = hashRef.current !== null;
    const r = await ds.design.settle(projectId, annotationId, { status, ...(reason ? { reason } : {}) });
    if (r.error || !r.data) return r.error?.message ?? "The feedback could not be answered.";
    if (!hadDraft) { const v = await read(); if (v) adopt(v); return null; }
    hashRef.current = r.data.documentHash;
    putNotes(notesRef.current.map((a) => (a.id === annotationId ? r.data!.annotation : a)));
    return null;
  }, [ds, projectId, persist, read, adopt]);

  /** Sends the draft, as saved, to the decision owner. */
  const submit = useCallback(async () => {
    await persist();
    if (dirty() || !hashRef.current) return "Save the draft first.";
    const r = await ds.design.submit(projectId, hashRef.current);
    if (r.error) return r.error.message;
    await reload();
    return null;
  }, [ds, projectId, persist, reload]);

  /** An approved version as the design again: a change like any other, so undo takes it back and autosave keeps it. */
  const restore = useCallback(async (version: number) => {
    const r = await ds.design.version(projectId, version);
    if (r.error || !r.data) return r.error?.message ?? "That version could not be read.";
    return commit({ type: "RESTORE", doc: r.data, label: `Restored version ${version}` });
  }, [ds, projectId, commit]);

  const doc = useMemo(() => (hist ? { ...hist.present, annotations: notes } : null), [hist, notes]);
  return {
    view, doc, editable, loadError, reload, commit, undo: () => step("undo"), redo: () => step("redo"), canUndo: !!hist?.past.length, canRedo: !!hist?.future.length,
    saveState, saveNote, retrySave: persist, annotate, settle, submit, restore,
  };
}
