"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyOp, snapshotOf, type Op } from "@/lib/design/ops";
import { makeSampleDocument } from "@/lib/design/sample";
import type { DesignDocument } from "@/lib/design/sdd";
import type { Result } from "@/lib/data/types";

export type DesignStore = {
  /** Where the design is kept, in words the person can read. */
  where: "agency" | "device";
  load(projectId: string): Promise<Result<DesignDocument | null>>;
  save(doc: DesignDocument, baseRevision: number): Promise<Result<{ revision: number }>>;
};
export type SaveState = "saved" | "saving" | "unsaved" | "failed" | "conflict";
type Hist = { past: DesignDocument[]; present: DesignDocument; future: DesignDocument[] };

const LIMIT = 100;
const entry = (d: DesignDocument, by: string, summary: string): DesignDocument["revisions"][number] => ({ n: d.revision + 1, at: new Date().toISOString(), by, summary });

/**
 * The Workshop's state: one design document, a history that undo and redo walk through (human and proposed changes alike),
 * and autosave. Autosave keeps the work; it is never an approval. Undo and redo are themselves revisions, so the record only
 * ever moves forward and says who stepped back.
 */
export function useWorkshop(projectId: string, projectName: string, actor: string, store: DesignStore) {
  const [hist, setHist] = useState<Hist | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveNote, setSaveNote] = useState<string>("");
  const [created, setCreated] = useState(false);
  const histRef = useRef<Hist | null>(null);
  const savedRev = useRef(0);
  const timer = useRef(0);
  const coalesce = useRef<{ key: string; at: number } | null>(null);
  const storeRef = useRef(store);
  useEffect(() => { storeRef.current = store; }, [store]);

  const put = (h: Hist | null) => { histRef.current = h; setHist(h); };

  const persist = useCallback(async () => {
    const h = histRef.current;
    if (!h) return;
    setSaveState("saving");
    const res = await storeRef.current.save(h.present, savedRev.current);
    if (res.error) {
      setSaveState(res.error.code === "REVISION_CONFLICT" ? "conflict" : "failed");
      setSaveNote(res.error.message);
      return;
    }
    savedRev.current = res.data?.revision ?? h.present.revision;
    setSaveNote("");
    setSaveState(histRef.current && histRef.current.present.revision !== h.present.revision ? "unsaved" : "saved");
  }, []);

  // Fetch only sets state after the reply arrives. Switching project remounts the editor, so a first load needs no reset.
  const fetchDoc = useCallback(async () => {
    const res = await storeRef.current.load(projectId);
    if (res.error) { setLoadError(res.error.message); return; }
    if (res.data) {
      savedRev.current = res.data.revision;
      put({ past: [], present: res.data, future: [] });
      setCreated(false);
      setSaveState("saved");
      return;
    }
    // Nothing kept yet: the fixture provider supplies the three territories to start from.
    const fresh = makeSampleDocument(projectId, projectName, actor);
    savedRev.current = 0;
    put({ past: [], present: fresh, future: [] });
    setCreated(true);
    setSaveState("unsaved");
  }, [projectId, projectName, actor]);
  const load = useCallback(() => { setLoadError(null); put(null); return fetchDoc(); }, [fetchDoc]);

  useEffect(() => { void fetchDoc(); }, [fetchDoc]);

  // Autosave shortly after the last change, and once more when the Workshop closes.
  const rev = hist?.present.revision;
  useEffect(() => {
    if (rev === undefined || (rev === savedRev.current && !created)) return;
    setSaveState((s) => (s === "conflict" ? s : "unsaved"));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void persist(); }, 700);
    return () => window.clearTimeout(timer.current);
  }, [rev, created, persist]);
  useEffect(() => () => { window.clearTimeout(timer.current); const h = histRef.current; if (h && h.present.revision !== savedRev.current) void storeRef.current.save(h.present, savedRev.current); }, []);

  /** Returns a message when the change was refused (for example a locked node), otherwise null. */
  const commit = useCallback((op: Op, opts?: { coalesce?: string }): string | null => {
    const h = histRef.current;
    if (!h) return null;
    const res = applyOp(h.present, op, actor);
    if (res.error) return res.error;
    if (res.doc === h.present) return null;
    const now = Date.now();
    const merge = !!opts?.coalesce && coalesce.current?.key === opts.coalesce && now - coalesce.current.at < 900;
    coalesce.current = opts?.coalesce ? { key: opts.coalesce, at: now } : null;
    let doc = res.doc;
    if (merge) {
      // The same kind of edit made again straight away is one step in the history, not twenty.
      const last = doc.revisions[doc.revisions.length - 1]!;
      doc = { ...doc, revision: h.present.revision, revisions: [...h.present.revisions.slice(0, -1), { ...last, n: h.present.revision }], decisionLog: doc.decisionLog.length > h.present.decisionLog.length ? [...h.present.decisionLog.slice(0, -1), doc.decisionLog[doc.decisionLog.length - 1]!] : doc.decisionLog };
      put({ past: h.past, present: doc, future: [] });
    } else {
      put({ past: [...h.past, h.present].slice(-LIMIT), present: doc, future: [] });
    }
    return null;
  }, [actor]);

  const step = useCallback((dir: "undo" | "redo") => {
    const h = histRef.current;
    if (!h) return;
    const from = dir === "undo" ? h.past : h.future;
    const target = from[from.length - 1];
    if (!target) return;
    const label = h.present.revisions[h.present.revisions.length - 1]?.summary ?? "a change";
    const next: DesignDocument = {
      ...target,
      revision: h.present.revision + 1,
      revisions: [...h.present.revisions, entry(h.present, actor, `${dir === "undo" ? "Undid" : "Redid"}: ${label}`)].slice(-200),
      decisionLog: h.present.decisionLog,
      checkpoints: h.present.checkpoints,
    };
    coalesce.current = null;
    put(dir === "undo" ? { past: h.past.slice(0, -1), present: next, future: [...h.future, h.present] } : { past: [...h.past, h.present], present: next, future: h.future.slice(0, -1) });
  }, [actor]);

  const checkpoint = useCallback((name: string) => {
    const h = histRef.current;
    if (!h) return;
    const d = h.present;
    const cp = { id: `cp-${Date.now().toString(36)}`, name: name.trim() || `Checkpoint at r${d.revision}`, at: new Date().toISOString(), by: actor, revision: d.revision, snapshot: snapshotOf(d) };
    const next: DesignDocument = { ...d, revision: d.revision + 1, checkpoints: [...d.checkpoints, cp].slice(-8), revisions: [...d.revisions, entry(d, actor, `Checkpoint: ${cp.name}`)].slice(-200) };
    put({ past: [...h.past, d].slice(-LIMIT), present: next, future: [] });
  }, [actor]);

  return { doc: hist?.present ?? null, canUndo: !!hist?.past.length, canRedo: !!hist?.future.length, commit, undo: () => step("undo"), redo: () => step("redo"), checkpoint, saveState, saveNote, retrySave: persist, reload: load, loadError, created, where: store.where };
}
