"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDataSource } from "@/lib/data";
import { drawn } from "@/lib/design/edit";
import { POSTURE_WORDS, choosing, documentOf, framesOf, layoutOf, slotOf, tokenLines, treeOf, type NodeTree, type SddDocument, type SddTerritory, type StudyFrame } from "@/lib/design/v4";
import { Artboard } from "./canvas";
import { Empty } from "../views";

/**
 * The directions territory exploration drew, from v4's design document (ADR-0049): three territories side by side, each with its
 * key frames and the thinking behind it, and the choice between them. Each key frame is drawn as v4 placed it, in the direction's
 * own colours and type, and is a section of a page rather than a whole one; the words on it are placeholders for the copy Content
 * writes and images are marked as such (Design §45.3). Choosing answers the question the work asked; v4 decides who may, and this
 * only says what it answered.
 */
export function Directions({ projectId, onChosen }: { projectId: string; onChosen?: (() => void) | undefined }) {
  const ds = useDataSource();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["sdd", projectId], queryFn: async () => { const r = await ds.design.read(projectId); if (r.error) throw new Error(r.error.message); return r.data!; } });
  const [msg, setMsg] = useState<string | null>(null);
  const [chosenHere, setChosenHere] = useState<string | null>(null);
  if (q.isLoading) return null;
  if (q.error) return <p className="mmsg" role="status">{q.error.message}</p>;
  const doc = documentOf(q.data);
  if (!doc || doc.territories.length === 0) return <Empty title="No directions drawn yet.">They appear here once territory exploration has run for this project.</Empty>;
  const open = choosing(doc) && !chosenHere;

  const choose = async (t: SddTerritory, changes: string) => {
    setMsg(null);
    const r = await ds.design.selectTerritory(projectId, t.id, changes);
    if (r.error) { setMsg(r.error.message); return; }
    setChosenHere(t.id);
    setMsg(`Chosen: ${t.concept}. The work goes on in this direction${changes.trim() ? ", with your changes" : ""}.`);
    // The document is not read again here: a client sees the draft only while the choice is theirs, so it would vanish with the
    // answer. The next visit reads v4's, which already holds the choice.
    await qc.invalidateQueries({ queryKey: ["case"] });
    onChosen?.();
  };

  return <section className="directions" aria-label="Design directions">
    <header className="directions-head">
      <b>{open ? "Choose a direction" : "The directions explored"}</b>
      <p>{doc.basis.reason || "Three directions, each drawn as key frames for a desktop and a phone."} Each frame shows the part of a page that carries the idea, in that direction's colours and type. They are not finished designs: the words are placeholders for the copy that is written next, and images are marked.</p>
    </header>
    <div className="directions-grid">
      {doc.territories.map((t) => <Territory key={t.id} doc={doc} territory={t} open={open} chosenHere={chosenHere} onChoose={choose} />)}
    </div>
    {msg && <p className="mmsg" role="status">{msg}</p>}
  </section>;
}

function Territory({ doc, territory: t, open, chosenHere, onChoose }: { doc: SddDocument; territory: SddTerritory; open: boolean; chosenHere: string | null; onChoose: (t: SddTerritory, changes: string) => Promise<void> }) {
  const [withChanges, setWithChanges] = useState(false);
  const [changes, setChanges] = useState("");
  const [busy, setBusy] = useState(false);
  const status = chosenHere ? (chosenHere === t.id ? "Chosen" : "Set aside") : t.status === "SELECTED" ? "Chosen" : t.status === "SET_ASIDE" ? "Set aside" : null;
  const go = async (text: string) => { setBusy(true); await onChoose(t, text); setBusy(false); };
  const frames = framesOf(doc, t.id);
  return <article className={`direction ${status === "Chosen" ? "is-chosen" : status ? "is-aside" : ""}`} aria-label={t.concept}>
    <div className="direction-head">
      <span className="direction-posture">{t.posture ? POSTURE_WORDS[t.posture] ?? t.posture : "Direction"}</span>
      {status && <span className="pill">{status.toUpperCase()}</span>}
      <span className="direction-flag" title="The words and images are placeholders until Content and the art direction fill them.">Placeholders</span>
    </div>
    <h3>{t.concept}</h3>
    {t.thesis && <p className="direction-thesis">{t.thesis}</p>}
    <div className="direction-frames">
      {frames.length === 0 ? <small>No key frames were drawn for this direction.</small> : frames.map((f) => <KeyFrame key={f.id} doc={doc} frame={f} />)}
    </div>
    <details className="direction-detail">
      <summary>The thinking behind it</summary>
      <dl>
        {([["Reading of the brief", t.meaningInterpretation], ["What the audience experiences", t.audienceExperience], ["Composition", t.composition], ["Typography", t.typography], ["Art direction", t.artDirection], ["Colour and material", t.colourAndMaterial], ["Interaction and motion", t.interactionAndMotion], ["Answers the brief by", t.addressesBrief], ["Deliberately not", t.deliberatelyNot], ["Technique", [t.technique, t.techniqueMapping].filter(Boolean).join(": ")]] as const).map(([k, v]) => v ? <div key={k}><dt>{k}</dt><dd>{v}</dd></div> : null)}
        {t.signature && <div><dt>Signature</dt><dd>{"device" in t.signature ? t.signature.device : `None: ${t.signature.noneBecause}`}</dd></div>}
      </dl>
      {([["Strengths", t.strengths], ["Weaknesses", t.weaknesses], ["Risks", t.risks], ["Trade-offs", t.tradeoffs]] as const).map(([k, list]) => list.length ? <div key={k} className="direction-list"><b>{k}</b><ul>{list.map((x) => <li key={x}>{x}</li>)}</ul></div> : null)}
      {tokenLines(t).length > 0 && <div className="direction-list"><b>Tokens</b><ul>{tokenLines(t).map((x) => <li key={`${x.group}.${x.name}`}><code>{x.group}.{x.name}</code> {x.value}</li>)}</ul></div>}
    </details>
    {open && <div className="direction-choose">
      {withChanges
        ? <><label>What should change?<textarea value={changes} maxLength={1000} onChange={(e) => setChanges(e.target.value)} /></label>
          <Button className="approve-btn" disabled={busy || !changes.trim()} onClick={() => void go(changes)}>Confirm: choose {t.concept} with these changes</Button>
          <Button variant="ghost" disabled={busy} onClick={() => setWithChanges(false)}>Cancel</Button></>
        : <><Button className="approve-btn" disabled={busy} onClick={() => void go("")}>Choose {t.concept}</Button>
          <Button variant="ghost" disabled={busy} onClick={() => setWithChanges(true)}>Choose with changes</Button></>}
    </div>}
  </article>;
}

/** One key frame as v4 placed it, scaled to the room it has. A frame with nothing placed yet is shown as its structure instead. */
function KeyFrame({ doc, frame }: { doc: SddDocument; frame: StudyFrame }) {
  const sdd = doc.frames.find((f) => f.id === frame.id);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!sdd?.width || !sdd.height || drawn(doc, sdd).length === 0) return <Wireframe doc={doc} frame={frame} />;
  const scale = width / sdd.width;
  return <figure className="keyframe" aria-label={`${frame.viewport} key frame`}>
    <div ref={ref} className="keyframe-board" style={{ height: Math.round(sdd.height * scale) }}>{width > 0 && <Artboard doc={doc} frameId={sdd.id} scale={scale} readOnly />}</div>
    <figcaption>{frame.viewport === "phone" ? "Phone" : frame.viewport === "desktop" ? "Desktop" : frame.viewport}</figcaption>
  </figure>;
}

/** One key frame drawn from its node tree: boxes nested as the nodes are, each named for its role, words shown as slots. */
function Wireframe({ doc, frame }: { doc: SddDocument; frame: StudyFrame }) {
  const tree = treeOf(doc, frame);
  return <figure className={`wireframe wireframe-${frame.viewport === "phone" ? "phone" : "desktop"}`} aria-label={`${frame.viewport} key frame`}>
    {tree ? <Box tree={tree} /> : <small>This frame has no root node.</small>}
    <figcaption>{frame.viewport === "phone" ? "Phone" : frame.viewport === "desktop" ? "Desktop" : frame.viewport}</figcaption>
  </figure>;
}

function Box({ tree: { node, children } }: { tree: NodeTree }) {
  const slot = slotOf(node);
  const layout = layoutOf(node);
  const kind = node.type === "text" ? "text" : node.type === "control" ? "control" : node.type === "image" || node.type === "media" ? "media" : "group";
  return <div className={`wire wire-${kind}`} title={layout || undefined} data-node={node.id}>
    <span className="wire-role">{node.role}</span>
    {slot && <span className="wire-slot">{slot.purpose || slot.key}{slot.maxChars ? <small> · up to {slot.maxChars} characters</small> : null}</span>}
    {children.map((c) => <Box key={c.node.id} tree={c} />)}
  </div>;
}

/** On a question from the work: when the project's directions are waiting for a choice, they open here, where the question is. */
export function DirectionsFor({ projectId, onChosen }: { projectId: string; onChosen?: (() => void) | undefined }) {
  const ds = useDataSource();
  const q = useQuery({ queryKey: ["sdd", projectId], queryFn: async () => { const r = await ds.design.read(projectId); if (r.error) throw new Error(r.error.message); return r.data!; } });
  const [open, setOpen] = useState(false);
  if (!choosing(documentOf(q.data)) && !open) return null;
  return <div className="directions-for">
    <Button variant="outline" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide the directions" : "See the three directions"}</Button>
    {open && <Directions projectId={projectId} onChosen={onChosen} />}
  </div>;
}
