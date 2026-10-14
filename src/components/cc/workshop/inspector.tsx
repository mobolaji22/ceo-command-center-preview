"use client";

import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Copy, Eye, EyeOff, Group, Lock, Trash2, Unlock, Ungroup, Wand2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Align, NodePatch, Op } from "@/lib/design/ops";
import type { ProposalKind } from "@/lib/design/proposals";
import { GENOME_KEYS, GENOME_LABEL, isLargeText, paintHex, surfaceUnder, territoryOf, type Checkpoint, type DesignDocument, type FontFamily, type Radius, type SNode, type TypeRole } from "@/lib/design/sdd";
import { fmtAgo } from "@/lib/format";
import { ContrastChip, Field, Num, PaintField, ROLES, Section } from "./fields";

export type InspectorTab = "design" | "tokens" | "genome" | "notes" | "history";
export const INSPECTOR_TABS: { id: InspectorTab; label: string }[] = [{ id: "design", label: "Design" }, { id: "tokens", label: "Tokens" }, { id: "genome", label: "Genome" }, { id: "notes", label: "Notes" }, { id: "history", label: "History" }];
type Run = (op: Op, opts?: { coalesce?: string }) => void;

export type InspectorProps = {
  doc: DesignDocument; territoryId: string; frameId: string; selection: string[]; setSelection: (ids: string[]) => void; run: Run; tab: InspectorTab; setTab: (t: InspectorTab) => void;
  propose: (kind: ProposalKind, ids?: string[]) => void; tool: "select" | "comment"; setTool: (t: "select" | "comment") => void; activePin: string | null; setActivePin: (id: string | null) => void;
  checkpoint: (name: string) => void; restore: (cp: Checkpoint) => void; actor: string;
};

const ALIGNS: { m: Align; icon: typeof AlignStartVertical; label: string }[] = [
  { m: "left", icon: AlignStartVertical, label: "Align left" }, { m: "center", icon: AlignCenterVertical, label: "Align centre" }, { m: "right", icon: AlignEndVertical, label: "Align right" },
  { m: "top", icon: AlignStartHorizontal, label: "Align top" }, { m: "middle", icon: AlignCenterHorizontal, label: "Align middle" }, { m: "bottom", icon: AlignEndHorizontal, label: "Align bottom" },
];

function IconBtn({ label, onClick, children, pressed, disabled }: { label: string; onClick: () => void; children: React.ReactNode; pressed?: boolean; disabled?: boolean }) {
  return <button type="button" className="ws-ibtn" aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>{children}</button>;
}

export function Inspector(p: InspectorProps) {
  return (
    <div className="ws-inspector">
      <div className="ws-tabs" role="tablist" aria-label="Inspector">
        {INSPECTOR_TABS.map((t) => <button key={t.id} role="tab" type="button" aria-selected={p.tab === t.id} className={p.tab === t.id ? "active" : ""} onClick={() => p.setTab(t.id)}>{t.label}</button>)}
      </div>
      <div className="ws-tabpanel" role="tabpanel">
        {p.tab === "design" && <DesignTab {...p} />}
        {p.tab === "tokens" && <TokensTab {...p} />}
        {p.tab === "genome" && <GenomeTab {...p} />}
        {p.tab === "notes" && <NotesTab {...p} />}
        {p.tab === "history" && <HistoryTab {...p} />}
      </div>
    </div>
  );
}

/* ---- Design: the selected element, or the frame when nothing is selected --------------------------------- */
function DesignTab(p: InspectorProps) {
  const { doc, selection, run } = p;
  const nodes = doc.nodes.filter((n) => selection.includes(n.id));
  const frame = doc.frames.find((f) => f.id === p.frameId);
  const terr = territoryOf(doc, p.territoryId);
  if (!frame || !terr) return null;
  const t = terr.tokens;
  const patch = (ids: string[], pt: NodePatch, label: string, key?: string) => run({ type: "PATCH", ids, patch: pt, label }, key ? { coalesce: key } : undefined);

  if (nodes.length === 0) {
    const placeholders = doc.nodes.filter((n) => n.frameId === frame.id && n.asset?.status === "placeholder").length;
    const approval = [...doc.approvals].reverse().find((a) => a.frameIds.includes(frame.id));
    return (
      <>
        <Section title="Frame">
          <p className="ws-note"><b>{frame.name}</b> · {frame.w}×{frame.h} · {frame.viewport}</p>
          <p className="ws-note">Select an element on the canvas, or in the layer list, to adjust it.</p>
        </Section>
        <Section title="Proposals" aside={<small className="ws-chip">Nothing changes until you accept</small>}>
          <div className="ws-actions"><Button variant="ghost" className="ws-btn" onClick={() => p.propose("contrast")}><Wand2 size={14} /> Fix low-contrast text</Button><Button variant="ghost" className="ws-btn" onClick={() => p.propose("grid")}><Wand2 size={14} /> Snap to the {t.space.base}px grid</Button></div>
        </Section>
        <Section title="Frame actions">
          <div className="ws-actions"><Button variant="ghost" className="ws-btn" onClick={() => run({ type: "FRAME_VARIANT", frameId: frame.id })}><Copy size={14} /> Duplicate as a variant</Button></div>
        </Section>
        <Section title="Approval">
          {placeholders > 0 && <p className="ws-warn">{placeholders} placeholder asset{placeholders === 1 ? "" : "s"} remain in this frame. Approving records that.</p>}
          <p className="ws-note">{approval ? (approval.stale ? `Approved at r${approval.revision}, then reopened. ${approval.staleReason ?? ""}` : `Approved at r${approval.revision} by ${approval.by}.`) : "Not approved yet."}</p>
          <Button className="ws-btn primary" onClick={() => run({ type: "APPROVE", frameIds: [frame.id] })}>Approve this frame at r{doc.revision + 1}</Button>
          <small className="ws-hint">Recorded in this design. The agency&apos;s authority policy decides what an approval allows.</small>
        </Section>
      </>
    );
  }

  const ids = nodes.map((n) => n.id);
  const one = nodes.length === 1 ? nodes[0]! : null;
  const anyLocked = nodes.some((n) => n.locked);
  const allHidden = nodes.every((n) => n.hidden);
  const grouped = nodes.every((n) => n.group) ;
  return (
    <>
      <Section title={one ? one.name : `${nodes.length} elements`} aside={one ? <small className="ws-chip">{one.kind}</small> : undefined}>
        {one && <div className="ws-grid2"><Field label="Name"><input value={one.name} onChange={(e) => patch(ids, { name: e.target.value }, "Renamed", `name:${one.id}`)} /></Field><Field label="Role" hint="What it is for"><input value={one.role} onChange={(e) => patch(ids, { role: e.target.value }, "Changed the role", `role:${one.id}`)} /></Field></div>}
        <div className="ws-row2">
          <IconBtn label={anyLocked ? "Unlock" : "Lock (protects it from edits and proposals)"} pressed={anyLocked} onClick={() => run({ type: "LOCK", ids, locked: !anyLocked })}>{anyLocked ? <Lock size={15} /> : <Unlock size={15} />}</IconBtn>
          <IconBtn label={allHidden ? "Show" : "Hide"} pressed={allHidden} onClick={() => patch(ids, { hidden: !allHidden }, allHidden ? "Shown" : "Hidden")}>{allHidden ? <EyeOff size={15} /> : <Eye size={15} />}</IconBtn>
          <IconBtn label="Duplicate" onClick={() => run({ type: "DUPLICATE", ids })}><Copy size={15} /></IconBtn>
          <IconBtn label="Delete" onClick={() => run({ type: "DELETE", ids })}><Trash2 size={15} /></IconBtn>
          {nodes.length > 1 && <IconBtn label={grouped ? "Ungroup" : "Group"} onClick={() => run({ type: "GROUP", ids, group: grouped ? undefined : `g-${Date.now().toString(36)}` })}>{grouped ? <Ungroup size={15} /> : <Group size={15} />}</IconBtn>}
        </div>
      </Section>

      {one && (
        <Section title="Position and size">
          <div className="ws-grid4">
            <Num label="X" value={one.x} onChange={(v) => run({ type: "RECT", id: one.id, x: v, y: one.y, w: one.w, h: one.h }, { coalesce: `rect:${one.id}` })} />
            <Num label="Y" value={one.y} onChange={(v) => run({ type: "RECT", id: one.id, x: one.x, y: v, w: one.w, h: one.h }, { coalesce: `rect:${one.id}` })} />
            <Num label="W" value={one.w} min={4} onChange={(v) => run({ type: "RECT", id: one.id, x: one.x, y: one.y, w: v, h: one.h }, { coalesce: `rect:${one.id}` })} />
            <Num label="H" value={one.h} min={4} onChange={(v) => run({ type: "RECT", id: one.id, x: one.x, y: one.y, w: one.w, h: v }, { coalesce: `rect:${one.id}` })} />
          </div>
        </Section>
      )}

      <Section title="Align" aside={nodes.length === 1 ? <small className="ws-chip">to the frame</small> : <small className="ws-chip">to each other</small>}>
        <div className="ws-row2">{ALIGNS.map((a) => <IconBtn key={a.m} label={a.label} onClick={() => run({ type: "ALIGN", ids, mode: a.m })}><a.icon size={15} /></IconBtn>)}</div>
        {nodes.length >= 3 && <div className="ws-actions"><Button variant="ghost" className="ws-btn" onClick={() => run({ type: "DISTRIBUTE", ids, axis: "x" })}>Distribute across</Button><Button variant="ghost" className="ws-btn" onClick={() => run({ type: "DISTRIBUTE", ids, axis: "y" })}>Distribute down</Button></div>}
      </Section>

      {one && <ElementStyle node={one} patch={patch} tokens={t} doc={doc} propose={p.propose} />}

      <Section title="Layer order">
        <div className="ws-row2">
          <IconBtn label="Bring to front" onClick={() => run({ type: "ORDER", ids, to: "front" })}><ArrowUpToLine size={15} /></IconBtn>
          <IconBtn label="Bring forward" onClick={() => run({ type: "ORDER", ids, to: "up" })}><ChevronUp size={15} /></IconBtn>
          <IconBtn label="Send backward" onClick={() => run({ type: "ORDER", ids, to: "down" })}><ChevronDown size={15} /></IconBtn>
          <IconBtn label="Send to back" onClick={() => run({ type: "ORDER", ids, to: "back" })}><ArrowDownToLine size={15} /></IconBtn>
        </div>
      </Section>
    </>
  );
}

function ElementStyle({ node, patch, tokens, doc, propose }: { node: SNode; patch: (ids: string[], pt: NodePatch, label: string, key?: string) => void; tokens: ReturnType<typeof territoryOf> extends infer T ? (T extends { tokens: infer K } ? K : never) : never; doc: DesignDocument; propose: (k: ProposalKind, ids?: string[]) => void }) {
  const ids = [node.id];
  const hasFill = node.kind !== "text";
  const text = node.text;
  const style = text ? tokens.type[text.style] : null;
  const fg = text ? paintHex(text.color, tokens) : "";
  const bg = text ? (node.kind === "button" ? paintHex(node.fill, tokens, tokens.color.surface) : surfaceUnder(doc, node)) : "";
  return (
    <>
      {hasFill && (
        <Section title="Appearance">
          <PaintField label={node.kind === "image" ? "Placeholder fill" : "Fill"} value={node.fill} tokens={tokens} allowNone onChange={(v) => patch(ids, { fill: v }, "Changed the fill", `fill:${node.id}`)} />
          <PaintField label="Border" value={node.stroke} tokens={tokens} allowNone onChange={(v) => patch(ids, { stroke: v }, "Changed the border", `stroke:${node.id}`)} />
          <div className="ws-grid2">
            <Field label="Corners"><select value={node.radius ?? "none"} onChange={(e) => patch(ids, { radius: e.target.value as Radius }, "Changed the corners")}><option value="none">Square</option><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option><option value="full">Round</option></select></Field>
            <Num label="Opacity" value={Math.round((node.opacity ?? 1) * 100)} min={0} max={100} suffix="%" onChange={(v) => patch(ids, { opacity: Math.max(0, Math.min(100, v)) / 100 }, "Changed the opacity", `op:${node.id}`)} />
          </div>
        </Section>
      )}
      {text && style && (
        <Section title="Text">
          <Field label="Content"><textarea rows={3} value={text.content} onChange={(e) => patch(ids, { text: { content: e.target.value }, name: e.target.value.length > 28 ? e.target.value.slice(0, 26) + "…" : e.target.value }, "Edited the text", `txt:${node.id}`)} /></Field>
          <div className="ws-grid2">
            <Field label="Type style"><select value={text.style} onChange={(e) => patch(ids, { text: { style: e.target.value as TypeRole } }, "Changed the type style")}>{(["display", "heading", "body", "label"] as const).map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)} · {tokens.type[s].size}px</option>)}</select></Field>
            <Field label="Alignment"><select value={text.align} onChange={(e) => patch(ids, { text: { align: e.target.value as "left" | "center" | "right" } }, "Changed the alignment")}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></Field>
          </div>
          <div className="ws-grid2">
            <Num label="Size" value={text.size ?? style.size} min={8} max={240} suffix="px" onChange={(v) => patch(ids, { text: { size: v === style.size ? undefined : v } }, "Changed the text size", `size:${node.id}`)} />
            <Field label="Size follows"><Button variant="ghost" className="ws-btn" disabled={text.size === undefined} onClick={() => patch(ids, { text: { size: undefined } }, "Reset the text size to its style")}>{text.size === undefined ? "The type style" : "Reset to the style"}</Button></Field>
          </div>
          <PaintField label="Text colour" value={text.color} tokens={tokens} onChange={(v) => v && patch(ids, { text: { color: v } }, "Changed the text colour", `tc:${node.id}`)} />
          <div className="ws-contrast-row"><ContrastChip fg={fg} bg={bg} large={isLargeText(text.size ?? style.size, style.weight)} /><Button variant="ghost" className="ws-btn" onClick={() => propose("contrast", ids)}><Wand2 size={14} /> Suggest a fix</Button></div>
        </Section>
      )}
      {node.kind === "image" && <Section title="Asset"><p className="ws-warn">{node.asset?.status === "placeholder" ? "A placeholder. It is marked on the canvas so it cannot be mistaken for a final image." : "A supplied asset."}</p></Section>}
    </>
  );
}

/* ---- Tokens: the semantic values every element refers to ---------------------------------------------------- */
function TokensTab({ doc, territoryId, run }: InspectorProps) {
  const terr = territoryOf(doc, territoryId);
  if (!terr) return null;
  const t = terr.tokens;
  const tok = (label: string, apply: (x: typeof t) => typeof t, key: string) => run({ type: "TOKEN", territoryId, apply, label }, { coalesce: key });
  return (
    <>
      <p className="ws-note">Editing <b>{terr.name}</b>. Changing a token changes every element that uses it, in every frame of this direction.</p>
      <Section title="Colour roles">
        {ROLES.map((r) => (
          <div key={r.id} className="wf wf-token">
            <label htmlFor={`tok-${r.id}`} className="wf-label">{r.label}</label>
            <div className="wf-row">
              <input id={`tok-${r.id}`} type="color" value={t.color[r.id]} onChange={(e) => tok(`Colour: ${r.label} to ${e.target.value.toUpperCase()}`, (x) => ({ ...x, color: { ...x.color, [r.id]: e.target.value } }), `tok:c:${r.id}`)} />
              <input className="wf-hex" aria-label={`${r.label} hex value`} value={t.color[r.id]} maxLength={7} onChange={(e) => { const v = e.target.value; if (/^#[0-9a-f]{6}$/i.test(v)) tok(`Colour: ${r.label} to ${v.toUpperCase()}`, (x) => ({ ...x, color: { ...x.color, [r.id]: v } }), `tok:c:${r.id}`); }} />
            </div>
          </div>
        ))}
        <div className="ws-contrasts">
          <ContrastChip label="Text on surface" fg={t.color.text} bg={t.color.surface} />
          <ContrastChip label="Muted on surface" fg={t.color.textMuted} bg={t.color.surface} />
          <ContrastChip label="Text on alternate" fg={t.color.text} bg={t.color.surfaceAlt} />
          <ContrastChip label="Muted on alternate" fg={t.color.textMuted} bg={t.color.surfaceAlt} />
          <ContrastChip label="On accent" fg={t.color.accentText} bg={t.color.accent} />
          <ContrastChip label="Accent on surface" fg={t.color.accent} bg={t.color.surface} large />
        </div>
      </Section>
      <Section title="Type">
        {(["display", "heading", "body", "label"] as const).map((role) => {
          const s = t.type[role];
          const set = (patch: Partial<typeof s>, what: string) => tok(`Type: ${role} ${what}`, (x) => ({ ...x, type: { ...x.type, [role]: { ...x.type[role], ...patch } } }), `tok:t:${role}:${what}`);
          return (
            <fieldset key={role} className="ws-fieldset"><legend>{role[0]!.toUpperCase() + role.slice(1)}</legend>
              <div className="ws-grid2">
                <Field label="Family"><select value={s.family} onChange={(e) => set({ family: e.target.value as FontFamily }, "family")}><option value="serif">Serif (Cormorant)</option><option value="sans">Sans (DM Sans)</option><option value="mono">Monospace</option><option value="grotesk">Grotesk (system)</option></select></Field>
                <Field label="Weight"><select value={s.weight} onChange={(e) => set({ weight: Number(e.target.value) }, "weight")}>{[400, 500, 600, 700].map((w) => <option key={w} value={w}>{w}</option>)}</select></Field>
              </div>
              <div className="ws-grid3"><Num label="Size" value={s.size} min={8} max={200} suffix="px" onChange={(v) => set({ size: v }, "size")} /><Num label="Tracking" value={s.tracking} step={0.1} suffix="px" onChange={(v) => set({ tracking: v }, "tracking")} /><Num label="Line" value={s.lineHeight} min={0.8} max={2.4} step={0.05} onChange={(v) => set({ lineHeight: v }, "line")} /></div>
            </fieldset>
          );
        })}
      </Section>
      <Section title="Shape, space and motion">
        <div className="ws-grid3">
          <Num label="Radius S" value={t.radius.sm} min={0} onChange={(v) => tok("Radius: small", (x) => ({ ...x, radius: { ...x.radius, sm: v } }), "tok:r:sm")} />
          <Num label="Radius M" value={t.radius.md} min={0} onChange={(v) => tok("Radius: medium", (x) => ({ ...x, radius: { ...x.radius, md: v } }), "tok:r:md")} />
          <Num label="Radius L" value={t.radius.lg} min={0} onChange={(v) => tok("Radius: large", (x) => ({ ...x, radius: { ...x.radius, lg: v } }), "tok:r:lg")} />
        </div>
        <div className="ws-grid3">
          <Field label="Spacing base"><select value={t.space.base} onChange={(e) => tok(`Spacing base: ${e.target.value}px`, (x) => ({ ...x, space: { base: Number(e.target.value) } }), "tok:space")}>{[4, 8, 10, 12].map((b) => <option key={b} value={b}>{b}px</option>)}</select></Field>
          <Num label="Motion" value={t.motion.durationMs} min={0} max={2000} step={20} suffix="ms" onChange={(v) => tok("Motion duration", (x) => ({ ...x, motion: { ...x.motion, durationMs: v } }), "tok:m:d")} />
          <Field label="Easing"><select value={t.motion.easing} onChange={(e) => tok("Motion easing", (x) => ({ ...x, motion: { ...x.motion, easing: e.target.value as typeof x.motion.easing } }), "tok:m:e")}><option value="ease-out">Ease out</option><option value="ease-in-out">Ease in-out</option><option value="linear">Linear</option></select></Field>
        </div>
      </Section>
    </>
  );
}

/* ---- Genome: the twelve decisions behind the direction ---------------------------------------------------- */
function GenomeTab({ doc, territoryId, run }: InspectorProps) {
  const terr = territoryOf(doc, territoryId);
  if (!terr) return null;
  return (
    <>
      <p className="ws-note">The design genome of <b>{terr.name}</b>: each dimension is a decision with a reason, not a mood word. Edit a decision when the design has moved.</p>
      <Section title="Direction"><p className="ws-note"><b>Thesis.</b> {terr.thesis}</p><p className="ws-note"><b>Signature.</b> {terr.signature}</p></Section>
      {GENOME_KEYS.map((k) => {
        const g = terr.genome[k];
        return (
          <fieldset key={k} className="ws-fieldset"><legend>{GENOME_LABEL[k]}</legend>
            <Field label="Decision"><textarea rows={2} value={g.decision} onChange={(e) => run({ type: "GENOME", territoryId, key: k, patch: { decision: e.target.value } }, { coalesce: `gen:${k}:d` })} /></Field>
            <Field label="Why"><textarea rows={2} value={g.rationale} onChange={(e) => run({ type: "GENOME", territoryId, key: k, patch: { rationale: e.target.value } }, { coalesce: `gen:${k}:r` })} /></Field>
            <Field label="Confidence"><select value={g.confidence} onChange={(e) => run({ type: "GENOME", territoryId, key: k, patch: { confidence: e.target.value as "high" | "medium" | "low" } })}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></Field>
          </fieldset>
        );
      })}
    </>
  );
}

/* ---- Notes and decisions ---------------------------------------------------------------------------------- */
function NotesTab({ doc, frameId, run, tool, setTool, activePin, setActivePin, setSelection }: InspectorProps) {
  const notes = doc.annotations.filter((a) => a.frameId === frameId);
  const [summary, setSummary] = useState("");
  const [why, setWhy] = useState("");
  return (
    <>
      <Section title="Notes on this frame" aside={<Button variant="ghost" className={`ws-btn${tool === "comment" ? " primary" : ""}`} aria-pressed={tool === "comment"} onClick={() => setTool(tool === "comment" ? "select" : "comment")}>{tool === "comment" ? "Click the canvas to place a note" : "Add a note"}</Button>}>
        {notes.length === 0 ? <p className="ws-note">No notes yet. Turn on Add a note, then click where it belongs.</p> : notes.map((a, i) => (
          <div key={a.id} className={`ws-card${activePin === a.id ? " is-active" : ""}${a.resolved ? " is-resolved" : ""}`}>
            <div className="ws-card-head"><span className="ws-pinno">{i + 1}</span><small>{a.by} · {fmtAgo(a.at)}</small></div>
            <textarea rows={2} aria-label={`Note ${i + 1}`} placeholder="What needs attention?" value={a.text} onFocus={() => setActivePin(a.id)} onChange={(e) => run({ type: "NOTE_EDIT", id: a.id, patch: { text: e.target.value } }, { coalesce: `note:${a.id}` })} />
            <div className="ws-actions">
              <label className="ws-check"><input type="checkbox" checked={a.resolved} onChange={(e) => run({ type: "NOTE_EDIT", id: a.id, patch: { resolved: e.target.checked } })} /> Resolved</label>
              {a.nodeId && <Button variant="ghost" className="ws-btn" onClick={() => setSelection([a.nodeId!])}>Select element</Button>}
              <Button variant="ghost" className="ws-btn" onClick={() => run({ type: "NOTE_DELETE", id: a.id })}>Delete</Button>
            </div>
          </div>
        ))}
      </Section>
      <Section title="Record a decision">
        <Field label="What was decided"><input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Keep the accent block, drop the second image" /></Field>
        <Field label="Why"><textarea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason, so the next person understands" /></Field>
        <Button className="ws-btn primary" disabled={!summary.trim()} onClick={() => { run({ type: "DECIDE", summary: summary.trim(), rationale: why.trim() }); setSummary(""); setWhy(""); }}>Record decision</Button>
      </Section>
      <Section title="Decision log">
        <ol className="ws-log">{[...doc.decisionLog].reverse().slice(0, 40).map((d) => <li key={d.id}><span className={`ws-kind k-${d.kind.toLowerCase()}`}>{d.kind.toLowerCase()}</span><div><b>{d.summary}</b>{d.rationale ? <p>{d.rationale}</p> : null}<small>{d.by} · {fmtAgo(d.at)}</small></div></li>)}</ol>
      </Section>
    </>
  );
}

/* ---- History: revisions, checkpoints, approvals ------------------------------------------------------------ */
function HistoryTab({ doc, checkpoint, restore }: InspectorProps) {
  const [name, setName] = useState("");
  return (
    <>
      <Section title="Checkpoints" aside={<small className="ws-chip">{doc.checkpoints.length} of 8</small>}>
        <div className="ws-grid-inline"><input aria-label="Checkpoint name" value={name} placeholder="Before the client call" onChange={(e) => setName(e.target.value)} /><Button className="ws-btn primary" onClick={() => { checkpoint(name); setName(""); }}>Create</Button></div>
        {doc.checkpoints.length === 0 ? <p className="ws-note">A checkpoint is a named point you can come back to.</p> : [...doc.checkpoints].reverse().map((c) => <div key={c.id} className="ws-card"><div className="ws-card-head"><b>{c.name}</b><small>r{c.revision} · {c.by} · {fmtAgo(c.at)}</small></div><Button variant="ghost" className="ws-btn" onClick={() => restore(c)}>Restore this</Button></div>)}
      </Section>
      <Section title="Approvals">
        {doc.approvals.length === 0 ? <p className="ws-note">Nothing approved yet. Approvals apply to a frame at a revision; a later change to that frame reopens it.</p> : [...doc.approvals].reverse().map((a) => <div key={a.id} className={`ws-card${a.stale ? " is-stale" : ""}`}><div className="ws-card-head"><b>{a.frameIds.map((f) => doc.frames.find((x) => x.id === f)?.name ?? "frame").join(", ")}</b><span className={`ws-chip ${a.stale ? "bad" : "good"}`}>{a.stale ? "Reopened" : "Approved"}</span></div><small>r{a.revision} · {a.by} · {fmtAgo(a.at)}</small>{a.stale && a.staleReason ? <p className="ws-note">{a.staleReason}</p> : null}</div>)}
      </Section>
      <Section title="Revisions">
        <ol className="ws-log">{[...doc.revisions].reverse().slice(0, 30).map((r) => <li key={r.n}><span className="ws-kind">r{r.n}</span><div><b>{r.summary}</b><small>{r.by} · {fmtAgo(r.at)}</small></div></li>)}</ol>
      </Section>
    </>
  );
}
