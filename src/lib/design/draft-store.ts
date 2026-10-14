import { SDD_SCHEMA, type DesignDocument } from "./sdd";

/**
 * A working copy of a design kept on this device. The demo data source saves here, and the Workshop falls back to it when the
 * agency's design service is not connected, saying so plainly. It is a draft, never the record: binding approval belongs to the
 * v4 authority policy, not to a browser.
 */
const key = (projectId: string) => `cc-design:${projectId}`;

export function loadDraft(projectId: string): DesignDocument | null {
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return null;
    const doc = JSON.parse(raw) as DesignDocument;
    return doc && doc.schemaVersion === SDD_SCHEMA && doc.projectId === projectId ? doc : null;
  } catch {
    return null;
  }
}

export function saveDraft(doc: DesignDocument): boolean {
  const attempt = (d: DesignDocument) => { localStorage.setItem(key(d.projectId), JSON.stringify(d)); };
  try {
    attempt(doc);
    return true;
  } catch {
    // Storage is full or blocked. Drop the oldest checkpoints once, then give up honestly.
    try { attempt({ ...doc, checkpoints: doc.checkpoints.slice(-3) }); return true; } catch { return false; }
  }
}

export const clearDraft = (projectId: string) => { try { localStorage.removeItem(key(projectId)); } catch { /* nothing to clear */ } };
