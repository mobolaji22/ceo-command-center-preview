"use client";

import { ArrowRight, X, type LucideIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LitImage } from "./lit-image";
import type { LitArt } from "./room-art";

export type Spot<K extends string = string> = {
  id: K;
  label: string;
  title: string;
  description: string;
  action: string;
  icon: LucideIcon;
  /** How many things need the person here. Zero draws no badge. */
  count?: number;
  /** Spoken version of the count for assistive tech (the badge itself is decorative). */
  countNote?: string;
};

/**
 * A room you stand in: one photograph with objects you can press. The CEO office and the client room are both this component,
 * so they cannot drift apart. Hotspot positions and preview positions live in the stylesheet by id (.hotspot-<id>,
 * .preview-<id>) because they depend on how the photograph is cropped at each screen width.
 *
 * A preview opens when a hover lingers or a hotspot takes keyboard focus, and pins when pressed (press again to unpin). While
 * one is pinned, hovering another hotspot shows that one until the pointer leaves, and then the pinned one returns.
 */
export function OfficeStage<K extends string>({
  art,
  alt,
  eyebrow,
  heading,
  line,
  sideLabel,
  spots,
  statusList,
  coordinate,
  previewText,
  actionDisabled,
  className,
  nav,
  autoPlace,
  onAct,
}: {
  art: LitArt;
  alt: string;
  eyebrow: string;
  heading: string;
  line: ReactNode;
  sideLabel: [string, string];
  spots: Spot<K>[];
  statusList: string;
  coordinate: ReactNode;
  previewText?: ((id: K) => string | undefined) | undefined;
  actionDisabled?: ((id: K) => boolean) | undefined;
  /** Extra class on the stage (the department rooms use it to place hotspots on each room's own objects). */
  className?: string | undefined;
  /** Controls pinned to the top-left of the room (a way back and a way sideways), above the photograph. */
  nav?: ReactNode;
  /** Put each preview beside the hotspot that opened it instead of at a fixed place; for rooms whose hotspots move with the photograph. */
  autoPlace?: boolean | undefined;
  /** `at` is where the pressed object sits on the stage, in percent, so the next screen can open out of it. */
  onAct: (id: K, at: { x: number; y: number }) => void;
}) {
  const [pinned, setPinned] = useState<K | null>(null);
  const [hovered, setHovered] = useState<K | null>(null);
  const [lastActed, setLastActed] = useState<K | null>(null);
  const timer = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const shown = hovered ?? pinned;
  const spot = spots.find((s) => s.id === shown);

  const hoverIn = (id: K, e: { pointerType: string }) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHovered(id), 140);
  };
  const hoverOut = (e: { pointerType: string }) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHovered(null), 220);
  };
  const keep = () => window.clearTimeout(timer.current);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  /** Where a hotspot sits on the stage, in percent. Measured, so it is right at every crop of the photograph. */
  const centreOf = (id: string) => {
    const stage = stageRef.current;
    const el = stage?.querySelector<HTMLElement>(`.hotspot-${id}`);
    return stage && el ? { x: ((el.offsetLeft + el.offsetWidth / 2) / stage.offsetWidth) * 100, y: ((el.offsetTop + el.offsetHeight / 2) / stage.offsetHeight) * 100 } : { x: 50, y: 55 };
  };
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const panel = panelRef.current;
    if (!autoPlace || !shown || !stage || !panel) return;
    const el = stage.querySelector<HTMLElement>(`.hotspot-${shown}`);
    if (!el) return;
    const cx = el.offsetLeft + el.offsetWidth / 2;
    const cy = el.offsetTop + el.offsetHeight / 2;
    const left = cx > stage.offsetWidth * 0.5 ? cx - panel.offsetWidth - 30 : cx + 30;
    panel.style.left = `${Math.max(16, Math.min(left, stage.offsetWidth - panel.offsetWidth - 16))}px`;
    panel.style.top = `${Math.max(90, Math.min(cy - panel.offsetHeight / 2, stage.offsetHeight - panel.offsetHeight - 90))}px`;
  }, [autoPlace, shown]);
  const close = () => {
    window.clearTimeout(timer.current);
    setPinned(null);
    setHovered(null);
  };

  return (
    <div ref={stageRef} className={`office-stage${className ? ` ${className}` : ""}`}>
      <LitImage art={art} alt={alt} sizes="100vw" quality={75} className="office-image" />
      <div className="office-vignette" />
      <div className="scene-intro">
        <div className="eyebrow"><span className="short-line" /> {eyebrow}</div>
        <h1>{heading}<span className="period">.</span></h1>
        <p>{line}</p>
      </div>
      {nav ? <div className="stage-nav">{nav}</div> : null}
      <div className="scene-side-label">{sideLabel[0]} <span /> {sideLabel[1]}</div>
      {spots.map((s) => (
        <Button
          key={s.id}
          variant="ghost"
          size="icon"
          className={`hotspot hotspot-${s.id} ${shown === s.id ? "selected" : ""}`}
          data-return-focus={lastActed === s.id || undefined}
          aria-label={`Preview ${s.label}`}
          aria-describedby={s.count ? `hotspot-note-${s.id}` : undefined}
          title={s.label}
          onPointerEnter={(e) => hoverIn(s.id, e)}
          onPointerLeave={hoverOut}
          onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) setHovered(s.id); }}
          onBlur={(e) => { if (!(e.relatedTarget instanceof Node && panelRef.current?.contains(e.relatedTarget))) setHovered(null); }}
          onClick={() => { window.clearTimeout(timer.current); setHovered(null); setPinned(pinned === s.id ? null : s.id); }}
        >
          <span className="hotspot-center" />
          {s.count ? <><span className="hotspot-badge" aria-hidden="true">{s.count > 9 ? "9+" : s.count}</span><span id={`hotspot-note-${s.id}`} className="sr-only">{s.countNote}</span></> : null}
        </Button>
      ))}
      {spot && (
        <div
          ref={panelRef}
          className={`hotspot-preview preview-${spot.id}`}
          onPointerEnter={keep}
          onPointerLeave={hoverOut}
          onBlur={(e) => {
            const next = e.relatedTarget;
            if (!(next instanceof Node && e.currentTarget.contains(next)) && !(next instanceof HTMLElement && next.classList.contains("hotspot"))) setHovered(null);
          }}
        >
          <div className="preview-top">
            <span className="preview-icon"><spot.icon size={17} /></span>
            <Button variant="ghost" size="icon" className="icon-button tiny" aria-label="Close preview" onClick={close}><X size={15} /></Button>
          </div>
          <div className="eyebrow gold">{spot.title}</div>
          <p className="preview-description">{previewText?.(spot.id) ?? spot.description}</p>
          <Button variant="ghost" className="text-action" disabled={actionDisabled?.(spot.id) ?? false} onClick={() => { const at = centreOf(spot.id); close(); setLastActed(spot.id); onAct(spot.id, at); }}>{spot.action} <ArrowRight size={15} /></Button>
        </div>
      )}
      <div className="scene-bottom">
        <div className="hotspot-status"><span className="pulse-dot" /> HOTSPOTS ACTIVE <span className="status-separator">/</span><span className="status-list">{statusList}</span></div>
        <div className="scene-coordinate">{coordinate}</div>
      </div>
    </div>
  );
}
