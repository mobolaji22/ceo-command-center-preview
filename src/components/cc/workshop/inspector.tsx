"use client";

import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Copy, Eye, EyeOff, Lock, Trash2, Unlock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { feedbackOn, targetWords, type Align, type NodePatch, type Op } from "@/lib/design/edit";
import {
  ANNOTATION_KINDS, FONT_STACK, KIND_WORDS, STATUS_WORDS, isLargeText, layoutOf, paintHex, slotOf, surfaceUnder, tokensOf, typeStyleOf,
  type AnnotationKind, type AnnotationTarget, type FontFamily, type SddAnnotation, type SddDocument, type SddNode, type SddTokens, type SddVersion,
} from "@/lib/design/v4";
import { fmtAgo } from "@/lib/format";
import { ContrastChip, Field, Num, PaintField, Section, tokenWords } from "./fields";

export type InspectorTab = "design" | "tokens" | "feedback" | "history";
export const INSPECTOR_TABS: { id: InspectorTab; label: string }[] = [{ id: "design", label: "Design" }, { id: "tokens", label: "Tokens" }, { id: "feedback", label: "Feedback" }, { id: "history", label: "Versions" }];
type Run = (op: Op, opts?: { coalesce?: string }) => void;

export type InspectorProps = {
  doc: SddDocument; frameId: string; selection: string[]; setSelection: (ids: string[]) => void; run: Run; tab: InspectorTab; setTab: (t: InspectorTab) => void;
  /** The agency, on a revision not waiting for a decision. */
  editable: boolean; agency: boolean; me: string | null; activePin: string | null; setActivePin: (id: string | null) => void;
  /** Where new feedback goes: an element, the frame, or the whole design, as the canvas last pointed. */
  target: AnnotationTarget; setTarget: (t: AnnotationTarget) => void;
  annotate: (target: AnnotationTarget, kind: AnnotationKind, text: string) => Promise<string | null>;
  settle: (id: string, status: "ADDRESSED" | "DECLINED", reason?: string) => Promise<string | null>;
  versions: SddVersion[]; restore: (version: number) => void; say: (m: string) => void;
};

const ALIGNS: { m: Align; icon: typeof AlignStartVertical; label: string }[] = [
  { m: "left", icon: AlignStartVertical, label: "Align left" }, { m: "center", icon: AlignCenterVertical, label: "Align centre" }, { m: "right", icon: AlignEndVertical, label: "Align right" },
  { m: "top", icon: AlignStartHorizontal, label: "Align top" }, { m: "middle", icon: AlignCenterHorizontal, label: "Align middle" }, { m: "bottom", icon: AlignEndHorizontal, label: "Align bottom" },
];
const FAMILIES = Object.keys(FONT_STACK) as FontFamily[];
const FAMILY_WORDS: Record<FontFamily, string> = { serif: "Serif", sans: "Sans", mono: "Monospace", grotesk: "Grotesk" };

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
        {p.tab === "feedback" && <FeedbackTab {...p} />}
        {p.tab === "history" && <VersionsTab {...p} />}
      </div>
    </div>
  );
}

/* ---- Design: the selected element, or the frame when nothing is selected --------------------------------- */
function DesignTab(p: InspectorProps) {
  const { doc, selection, run, editable } = p;
  const frame = doc.frames.find((f) => f.id === p.frameId);
  const t = tokensOf(doc, frame);
  const nodes = doc.nodes.filter((n) => selection.includes(n.id));
  if (!frame || !t) return null;
  const patch = (ids: string[], pt: NodePatch, label: string, key?: string) => run({ type: "PATCH", ids, patch: pt, label }, key ? { coalesce: key } : undefined);

  if (nodes.length === 0) {
    const territory = doc.territories.find((x) => x.id === frame.territoryId);
    const unplaced = frame.nodeIds.filter((id) => !doc.nodes.find((n) => n.id === id)?.geometry.box).length;
    return (
      <Section title="Frame">
        <p className="ws-note"><b>{frame.viewport === "phone" ? "Phone" : frame.viewport === "desktop" ? "Desktop" : frame.viewport ?? "Frame"}</b> · {frame.width}×{frame.height}{territory ? ` · ${territory.concept}` : ""}</p>
        <p className="ws-note">{editable ? "Select an element on the canvas, or in the layer list, to adjust it." : "Select an element to see how it is set."}</p>
        {unplaced > 0 && <p className="ws-warn">{unplaced} element{unplaced === 1 ? " has" : "s have"} no position yet, so {unplaced === 1 ? "it is" : "they are"} listed in the layers but not drawn.</p>}
      </Section>
    );
  }

  const ids = nodes.map((n) => n.id);
  const one = nodes.length === 1 ? nodes[0]! : null;
  const anyLocked = nodes.some((n) => n.locked);
  const allHidden = nodes.every((n) => n.hidden);
  return (
    <fieldset className="ws-plain" disabled={!editable}>
      <Section title={one ? tokenWords(one.role) : `${nodes.length} elements`} aside={one ? <small className="ws-chip">{one.type}</small> : undefined}>
        {one && <Field label="Role" hint="What it is for"><input value={one.role} onChange={(e) => e.target.value.trim() && patch(ids, { role: e.target.value }, "Changed the role", `role:${one.id}`)} /></Field>}
        {one && layoutOf(one) && <p className="ws-hint">Laid out from: “{layoutOf(one)}”</p>}
        <div className="ws-row2">
          <IconBtn label={anyLocked ? "Unlock" : "Lock (protects it from edits)"} pressed={anyLocked} onClick={() => run({ type: "LOCK", ids, locked: !anyLocked })}>{anyLocked ? <Lock size={15} /> : <Unlock size={15} />}</IconBtn>
          <IconBtn label={allHidden ? "Show" : "Hide"} pressed={allHidden} onClick={() => patch(ids, { hidden: !allHidden }, allHidden ? "Shown" : "Hidden")}>{allHidden ? <EyeOff size={15} /> : <Eye size={15} />}</IconBtn>
          <IconBtn label="Duplicate" onClick={() => run({ type: "DUPLICATE", ids })}><Copy size={15} /></IconBtn>
          <IconBtn label="Delete" onClick={() => run({ type: "DELETE", ids })}><Trash2 size={15} /></IconBtn>
        </div>
      </Section>

      {one?.geometry.box && (
        <Section title="Position and size">
          <div className="ws-grid4">
            {(["x", "y", "w", "h"] as const).map((k) => <Num key={k} label={k.toUpperCase()} value={one.geometry.box![k]} min={k === "w" || k === "h" ? 1 : 0} onChange={(v) => run({ type: "BOX", id: one.id, box: { ...one.geometry.box!, [k]: v } }, { coalesce: `box:${one.id}` })} />)}
          </div>
        </Section>
      )}

      <Section title="Align" aside={<small className="ws-chip">{nodes.length === 1 ? "within its container" : "to each other"}</small>}>
        <div className="ws-row2">{ALIGNS.map((a) => <IconBtn key={a.m} label={a.label} onClick={() => run({ type: "ALIGN", ids, mode: a.m })}><a.icon size={15} /></IconBtn>)}</div>
        {nodes.length >= 3 && <div className="ws-actions"><Button variant="ghost" className="ws-btn" onClick={() => run({ type: "DISTRIBUTE", ids, axis: "x" })}>Distribute across</Button><Button variant="ghost" className="ws-btn" onClick={() => run({ type: "DISTRIBUTE", ids, axis: "y" })}>Distribute down</Button></div>}
      </Section>

      {one && <ElementStyle node={one} patch={patch} tokens={t} doc={doc} />}

      <Section title="Layer order">
        <div className="ws-row2">
          <IconBtn label="Bring to front" onClick={() => run({ type: "ORDER", ids, to: "front" })}><ArrowUpToLine size={15} /></IconBtn>
          <IconBtn label="Bring forward" onClick={() => run({ type: "ORDER", ids, to: "up" })}><ChevronUp size={15} /></IconBtn>
          <IconBtn label="Send backward" onClick={() => run({ type: "ORDER", ids, to: "down" })}><ChevronDown size={15} /></IconBtn>
          <IconBtn label="Send to back" onClick={() => run({ type: "ORDER", ids, to: "back" })}><ArrowDownToLine size={15} /></IconBtn>
        </div>
      </Section>
    </fieldset>
  );
}

function ElementStyle({ node, patch, tokens: t, doc }: { node: SddNode; patch: (ids: string[], pt: NodePatch, label: string, key?: string) => void; tokens: SddTokens; doc: SddDocument }) {
  const ids = [node.id];
  const s = node.style;
  const text = node.text;
  const type = text ? typeStyleOf(t, text.style) : null;
  const slot = slotOf(node);
  const radii = Object.keys(t.radius);
  return (
    <>
      <Section title="Appearance">
        <PaintField label="Fill" value={s.fill} tokens={t} allowNone onChange={(v) => patch(ids, { style: { fill: v } }, "Changed the fill", `fill:${node.id}`)} />
        <PaintField label="Border" value={s.stroke} tokens={t} allowNone onChange={(v) => patch(ids, { style: { stroke: v } }, "Changed the border", `stroke:${node.id}`)} />
        <div className="ws-grid2">
          <Field label="Corners"><select value={s.radius ?? ""} onChange={(e) => patch(ids, { style: { radius: e.target.value || null } }, "Changed the corners")}><option value="">Square</option>{radii.map((r) => <option key={r} value={r}>{tokenWords(r)} · {t.radius[r]}px</option>)}<option value="full">Round</option></select></Field>
          <Num label="Opacity" value={Math.round(s.opacity * 100)} min={0} max={100} suffix="%" onChange={(v) => patch(ids, { style: { opacity: Math.max(0, Math.min(100, v)) / 100 } }, "Changed the opacity", `op:${node.id}`)} />
        </div>
      </Section>
      {text && type && (
        <Section title="Text">
          {slot && <p className="ws-note">The words are Content&apos;s: <b>{slot.purpose || slot.key}</b>{slot.maxChars ? `, up to ${slot.maxChars} characters` : ""}. Here they are set, not written.</p>}
          <div className="ws-grid2">
            <Field label="Type style"><select value={text.style} onChange={(e) => patch(ids, { text: { style: e.target.value } }, "Changed the type style")}>{Object.entries(t.type).map(([name, v]) => v && <option key={name} value={name}>{tokenWords(name)} · {v.size}px</option>)}</select></Field>
            <Field label="Alignment"><select value={text.align} onChange={(e) => patch(ids, { text: { align: e.target.value as typeof text.align } }, "Changed the alignment")}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></Field>
          </div>
          <div className="ws-grid2">
            <Num label="Size" value={text.size ?? type.size} min={8} max={240} suffix="px" onChange={(v) => patch(ids, { text: { size: v === type.size ? null : v } }, "Changed the text size", `size:${node.id}`)} />
            <Field label="Size follows"><button type="button" className="ws-btn" disabled={text.size === null} onClick={() => patch(ids, { text: { size: null } }, "Reset the text size to its style")}>{text.size === null ? "The type style" : "Reset to the style"}</button></Field>
          </div>
          <PaintField label="Text colour" value={text.colour} tokens={t} onChange={(v) => v && patch(ids, { text: { colour: v } }, "Changed the text colour", `tc:${node.id}`)} />
          <div className="ws-contrast-row"><ContrastChip fg={paintHex(text.colour, t, t.colour.text)} bg={surfaceUnder(doc, node, t)} large={isLargeText(text.size ?? type.size, type.weight)} /></div>
        </Section>
      )}
    </>
  );
}

/* ---- Tokens: the named values every element refers to ---------------------------------------------------- */
function TokensTab({ doc, frameId, run, editable }: InspectorProps) {
  const frame = doc.frames.find((f) => f.id === frameId);
  const territory = doc.territories.find((x) => x.id === frame?.territoryId) ?? null;
  const t = tokensOf(doc, frame);
  if (!t) return <p className="ws-note">This frame has no tokens yet.</p>;
  const set = (next: SddTokens, label: string, key: string) => run({ type: "TOKENS", territoryId: territory?.id ?? null, tokens: next, label }, { coalesce: key });
  return (
    <fieldset className="ws-plain" disabled={!editable}>
      <p className="ws-note">{territory ? <>The tokens of <b>{territory.concept}</b>.</> : "The design's tokens."} Changing one changes every element that uses it, in every frame of this direction.</p>
      <Section title="Colour">
        {Object.entries(t.colour).map(([name, hex]) => hex && (
          <div key={name} className="wf wf-token">
            <label htmlFor={`tok-${name}`} className="wf-label">{tokenWords(name)}</label>
            <div className="wf-row">
              <input id={`tok-${name}`} type="color" value={hex.toLowerCase()} onChange={(e) => set({ ...t, colour: { ...t.colour, [name]: e.target.value.toUpperCase() } }, `Colour: ${name} to ${e.target.value.toUpperCase()}`, `tok:c:${name}`)} />
              <input className="wf-hex" aria-label={`${tokenWords(name)} hex value`} defaultValue={hex} key={hex} maxLength={7} onChange={(e) => { const v = e.target.value; if (/^#[0-9a-f]{6}$/i.test(v)) set({ ...t, colour: { ...t.colour, [name]: v.toUpperCase() } }, `Colour: ${name} to ${v.toUpperCase()}`, `tok:c:${name}`); }} />
            </div>
          </div>
        ))}
        <div className="ws-contrasts"><ContrastChip label="Text on surface" fg={t.colour.text} bg={t.colour.surface} /></div>
      </Section>
      <Section title="Type">
        {Object.entries(t.type).map(([name, s]) => {
          if (!s) return null;
          const put = (pt: Partial<typeof s>, what: string) => set({ ...t, type: { ...t.type, [name]: { ...s, ...pt } } }, `Type: ${name} ${what}`, `tok:t:${name}:${what}`);
          return (
            <fieldset key={name} className="ws-fieldset"><legend>{tokenWords(name)}</legend>
              <div className="ws-grid2">
                <Field label="Family"><select value={s.family} onChange={(e) => put({ family: e.target.value as FontFamily }, "family")}>{FAMILIES.map((f) => <option key={f} value={f}>{FAMILY_WORDS[f]}</option>)}</select></Field>
                <Field label="Weight"><select value={s.weight} onChange={(e) => put({ weight: Number(e.target.value) }, "weight")}>{[300, 400, 500, 600, 700, 800].map((w) => <option key={w} value={w}>{w}</option>)}</select></Field>
              </div>
              <div className="ws-grid3"><Num label="Size" value={s.size} min={8} max={200} suffix="px" onChange={(v) => put({ size: v }, "size")} /><Num label="Tracking" value={s.tracking} min={-0.2} max={0.5} step={0.01} suffix="em" onChange={(v) => put({ tracking: v }, "tracking")} /><Num label="Line" value={s.lineHeight} min={0.8} max={2.4} step={0.05} onChange={(v) => put({ lineHeight: v }, "line")} /></div>
            </fieldset>
          );
        })}
      </Section>
      <Section title="Space and corners">
        <div className="ws-grid3">
          {Object.entries(t.space).map(([name, v]) => v !== undefined && <Num key={`s-${name}`} label={`Space ${tokenWords(name).toLowerCase()}`} value={v} min={0} suffix="px" onChange={(x) => set({ ...t, space: { ...t.space, [name]: Math.max(0, x) } }, `Space: ${name}`, `tok:s:${name}`)} />)}
          {Object.entries(t.radius).map(([name, v]) => v !== undefined && <Num key={`r-${name}`} label={`Radius ${tokenWords(name).toLowerCase()}`} value={v} min={0} suffix="px" onChange={(x) => set({ ...t, radius: { ...t.radius, [name]: Math.max(0, x) } }, `Radius: ${name}`, `tok:r:${name}`)} />)}
        </div>
        <p className="ws-hint">Spacing tokens set the gaps when the layout is drawn again; the elements here keep the positions they have.</p>
      </Section>
    </fieldset>
  );
}

/* ---- Feedback: typed, attributed by v4, answered by the agency -------------------------------------------- */
function FeedbackTab(p: InspectorProps) {
  const { doc, frameId, agency, me, activePin, setActivePin, setSelection, target, setTarget } = p;
  const frame = doc.frames.find((f) => f.id === frameId);
  const [kind, setKind] = useState<AnnotationKind>("FEEDBACK");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (!frame) return null;
  const list = feedbackOn(doc, frame);
  const open = list.filter((a) => a.status === "OPEN").length;
  const send = async () => {
    setBusy(true);
    const m = await p.annotate(target, kind, text.trim());
    setBusy(false);
    if (m) { p.say(m); return; }
    setText(""); p.say("Feedback added.");
  };
  const targets: Array<{ value: string; label: string; target: AnnotationTarget }> = [
    ...(target.kind === "NODE" ? [{ value: `NODE:${target.id}`, label: targetWords(doc, target), target }] : []),
    { value: `FRAME:${frame.id}`, label: "This frame", target: { kind: "FRAME", id: frame.id } },
    ...(frame.territoryId ? [{ value: `TERRITORY:${frame.territoryId}`, label: "This direction", target: { kind: "TERRITORY" as const, id: frame.territoryId } }] : []),
    { value: "DOCUMENT:", label: "The whole design", target: { kind: "DOCUMENT", id: null } },
  ];
  return (
    <>
      <Section title="Leave feedback" aside={<small className="ws-chip">Tap an element to point at it</small>}>
        <div className="ws-grid2">
          <Field label="About"><select value={`${target.kind}:${target.id ?? ""}`} onChange={(e) => setTarget(targets.find((x) => x.value === e.target.value)!.target)}>{targets.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></Field>
          <Field label="Kind"><select value={kind} onChange={(e) => setKind(e.target.value as AnnotationKind)}>{ANNOTATION_KINDS.map((k) => <option key={k} value={k}>{KIND_WORDS[k]}</option>)}</select></Field>
        </div>
        <Field label="What should change, or what you noticed"><textarea rows={3} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} placeholder={kind === "CHANGE_REQUEST" ? "A change the design must make before it is approved" : "A note for the agency"} /></Field>
        {kind === "CHANGE_REQUEST" && <p className="ws-hint">A change request must be answered before this design can be approved.</p>}
        <Button className="ws-btn primary" disabled={busy || !text.trim()} onClick={() => void send()}>Add {KIND_WORDS[kind].toLowerCase()}</Button>
      </Section>
      <Section title="On this frame" aside={<small className="ws-chip">{open} open</small>}>
        {list.length === 0 ? <p className="ws-note">No feedback here yet.</p> : list.map((a, i) => <FeedbackCard key={a.id} a={a} n={i + 1} doc={doc} active={activePin === a.id} mine={a.by === me} agency={agency} onFocus={() => { setActivePin(a.id); if (a.target.kind === "NODE" && a.target.id) setSelection([a.target.id]); }} settle={p.settle} say={p.say} />)}
      </Section>
    </>
  );
}

function FeedbackCard({ a, n, doc, active, mine, agency, onFocus, settle, say }: { a: SddAnnotation; n: number; doc: SddDocument; active: boolean; mine: boolean; agency: boolean; onFocus: () => void; settle: InspectorProps["settle"]; say: (m: string) => void }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const answer = async (status: "ADDRESSED" | "DECLINED") => {
    setBusy(true);
    const m = await settle(a.id, status, status === "DECLINED" ? reason.trim() : undefined);
    setBusy(false);
    if (m) say(m); else { setDeclining(false); setReason(""); }
  };
  return (
    <article className={`ws-card${active ? " is-active" : ""}${a.status !== "OPEN" ? " is-resolved" : ""}`} aria-label={`Feedback ${n}`} onClick={onFocus}>
      <div className="ws-card-head"><span className="ws-pinno">{n}</span><span className={`ws-kind k-${a.kind.toLowerCase()}`}>{KIND_WORDS[a.kind]}</span><small>{targetWords(doc, a.target)} · {mine ? "you" : "another person"}{a.at ? ` · ${fmtAgo(a.at)}` : ""}</small></div>
      <p className="ws-note">{a.text}</p>
      <p className={`ws-state s-${a.status.toLowerCase()}`}>{STATUS_WORDS[a.status]}{a.status === "ADDRESSED" && a.addressedIn ? ` in revision ${a.addressedIn}` : ""}{a.status === "DECLINED" && a.reason ? `: ${a.reason}` : ""}</p>
      {agency && a.status === "OPEN" && (declining
        ? <div className="ws-decline"><Field label="Why not (the client reads this)"><textarea rows={2} value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} /></Field><div className="ws-actions"><Button variant="ghost" className="ws-btn" onClick={() => setDeclining(false)}>Cancel</Button><Button className="ws-btn primary" disabled={busy || !reason.trim()} onClick={() => void answer("DECLINED")}>Decline with this reason</Button></div></div>
        : <div className="ws-actions"><Button variant="ghost" className="ws-btn" disabled={busy} onClick={(e) => { e.stopPropagation(); void answer("ADDRESSED"); }}>Mark addressed</Button><Button variant="ghost" className="ws-btn" disabled={busy} onClick={(e) => { e.stopPropagation(); setDeclining(true); }}>Decline</Button></div>)}
    </article>
  );
}

/* ---- Versions: what was approved, and restoring one as the next draft ------------------------------------ */
function VersionsTab({ versions, restore, editable }: InspectorProps) {
  return (
    <Section title="Approved versions">
      {versions.length === 0 ? <p className="ws-note">Nothing approved yet. Each approval is kept as a version you can come back to.</p> : versions.map((v) => (
        <div key={v.version} className="ws-card"><div className="ws-card-head"><b>Version {v.version}</b><small>approved {fmtAgo(v.approvedAt)}</small></div>
          {editable && <Button variant="ghost" className="ws-btn" onClick={() => restore(v.version)}>Restore as the draft</Button>}
        </div>
      ))}
      <p className="ws-hint">Undo and redo are kept on this device while the Workshop is open; the versions are the agency&apos;s record.</p>
    </Section>
  );
}
