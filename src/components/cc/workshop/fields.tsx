"use client";

import { useId, type ReactNode } from "react";
import { contrast, wcagLabel, type ColorRole, type Paint, type Tokens } from "@/lib/design/sdd";

/** Small form controls shared by the Workshop's panels. They are plain, labelled and keyboard friendly on purpose. */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="wf"><span className="wf-label">{label}</span>{children}{hint ? <small className="wf-hint">{hint}</small> : null}</label>;
}

export function Num({ label, value, onChange, min, max, step = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <label className="wf wf-num">
      <span className="wf-label">{label}</span>
      <span className="wf-input"><input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(e) => { const v = e.target.valueAsNumber; if (Number.isFinite(v)) onChange(v); }} />{suffix ? <em>{suffix}</em> : null}</span>
    </label>
  );
}

export const ROLES: { id: ColorRole; label: string }[] = [
  { id: "surface", label: "Surface" }, { id: "surfaceAlt", label: "Surface, alternate" }, { id: "text", label: "Text" }, { id: "textMuted", label: "Text, muted" },
  { id: "accent", label: "Accent" }, { id: "accentText", label: "Text on accent" }, { id: "border", label: "Border" }, { id: "focus", label: "Focus ring" },
];

/** A colour that is either one of the design's own roles or a custom value. Roles are preferred: they keep the design coherent. */
export function PaintField({ label, value, tokens, onChange, allowNone }: { label: string; value: Paint | undefined; tokens: Tokens; onChange: (p: Paint | undefined) => void; allowNone?: boolean }) {
  const id = useId();
  const mode = !value ? "none" : "token" in value ? value.token : "custom";
  const hex = !value ? "#000000" : "token" in value ? tokens.color[value.token] : value.hex;
  return (
    <div className="wf wf-paint">
      <label htmlFor={id} className="wf-label">{label}</label>
      <div className="wf-row">
        <span className="wf-swatch" style={{ background: value ? hex : "transparent" }} aria-hidden="true" />
        <select id={id} value={mode} onChange={(e) => { const v = e.target.value; onChange(v === "none" ? undefined : v === "custom" ? { hex } : { token: v as ColorRole }); }}>
          {allowNone && <option value="none">None</option>}
          {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          <option value="custom">Custom colour</option>
        </select>
        {mode === "custom" && <input type="color" aria-label={`${label}, custom colour`} value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : "#000000"} onChange={(e) => onChange({ hex: e.target.value })} />}
      </div>
    </div>
  );
}

export function ContrastChip({ fg, bg, large = false, label }: { fg: string; bg: string; large?: boolean; label?: string }) {
  const r = contrast(fg, bg);
  const verdict = wcagLabel(r, large);
  const bad = verdict === "Fails" || verdict === "Large text only";
  return <span className={`wf-contrast${bad ? " is-bad" : ""}`} title={`${r.toFixed(2)}:1`}>{label ? `${label} ` : ""}<b>{r.toFixed(1)}:1</b> {verdict}</span>;
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return <section className="wsec"><header><h3>{title}</h3>{aside}</header>{children}</section>;
}
