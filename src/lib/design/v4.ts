import type { SddDocument } from "./sdd.generated";

/**
 * v4's design document (dev-playbook-v4 ADR-0049 decision 5), as the Workshop reads it. The document's shape is v4's: its types are
 * generated from the schema v4 publishes (`npm run sdd:types`), and this file only names their parts and reads them. Nothing here
 * decides anything; choosing a direction is a call to v4, which decides who may.
 */
export type { SddDocument };
export type SddTerritory = SddDocument["territories"][number];
export type SddNode = SddDocument["nodes"][number];

/** What v4's `GET /v1/projects/:id/sdd` answers: the approved revision, and the one in progress if the reader may see it. */
export type SddView = {
  approved: { version: number; revision: number; approvedAt: string; document: SddDocument } | null;
  current: { proposalId: string; status: "DRAFT" | "SUBMITTED"; baseVersion: number | null; documentHash: string; document: SddDocument } | null;
};

/** A key frame as v4 assembles it from territory exploration: which territory, which viewport, its root and its nodes. */
export type StudyFrame = { id: string; territoryId: string; viewport: string; rootNodeId: string | null; nodeIds: string[] };

/** A slot for Content's words on a node: what it is for and how long it may be. The words themselves are Content's, never the canvas's. */
export type ContentSlot = { key: string; purpose: string; maxChars: number | null; status: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** The document a person is looking at: the one in progress if there is one, else the approved one. */
export const documentOf = (view: SddView | null | undefined): SddDocument | null => view?.current?.document ?? view?.approved?.document ?? null;

/** A territory's key frames, in the order v4 lists them. A frame record v4 did not write in this shape is left out, not guessed at. */
export function framesOf(doc: SddDocument, territoryId: string): StudyFrame[] {
  return doc.frames.flatMap((f) => {
    if (str(f["territoryId"]) !== territoryId) return [];
    const nodeIds = Array.isArray(f["nodeIds"]) ? f["nodeIds"].filter((n): n is string => typeof n === "string") : [];
    return [{ id: f.id, territoryId, viewport: str(f["viewport"]), rootNodeId: typeof f["rootNodeId"] === "string" ? f["rootNodeId"] : null, nodeIds }];
  });
}

/** The node's Content slot, if it has one. */
export function slotOf(node: SddNode): ContentSlot | null {
  const ref = isRecord(node.content) ? node.content["contentRef"] : null;
  if (!isRecord(ref)) return null;
  return { key: str(ref["key"]), purpose: str(ref["purpose"]), maxChars: typeof ref["maxChars"] === "number" ? ref["maxChars"] : null, status: str(ref["status"]) };
}

/** How the node is laid out, in the words territory exploration gave (a structured wireframe has no positions yet). */
export const layoutOf = (node: SddNode): string => (isRecord(node.geometry) ? str(node.geometry["description"]) : "");

/** A frame's nodes as a tree, from its root, following each node's parent. A node whose parent is missing is not drawn twice. */
export type NodeTree = { node: SddNode; children: NodeTree[] };
export function treeOf(doc: SddDocument, frame: StudyFrame): NodeTree | null {
  const inFrame = new Set(frame.nodeIds);
  const nodes = doc.nodes.filter((n) => inFrame.has(n.id));
  const root = nodes.find((n) => n.id === frame.rootNodeId) ?? nodes.find((n) => n.parentId === null);
  if (!root) return null;
  const seen = new Set<string>();
  const grow = (node: SddNode): NodeTree => {
    seen.add(node.id);
    return { node, children: nodes.filter((n) => n.parentId === node.id && !seen.has(n.id)).map(grow) };
  };
  return grow(root);
}

/** The direction is still to be chosen: the territories are there and none is selected. */
export const choosing = (doc: SddDocument | null): boolean => !!doc && doc.territories.length > 0 && doc.selectedTerritoryId === null;

export const POSTURE_WORDS: Record<string, string> = { CONSERVATIVE: "Conservative", DISTINCTIVE: "Distinctive", EXPERIMENTAL: "Experimental" };

/** A territory's tokens as v4 holds them (a group of named values each), for reading out. */
export function tokenLines(t: SddTerritory): Array<{ group: string; name: string; value: string }> {
  return Object.entries(t.tokens).flatMap(([group, list]) => (isRecord(list) ? Object.entries(list).map(([name, value]) => ({ group, name, value: str(value) })) : []));
}
