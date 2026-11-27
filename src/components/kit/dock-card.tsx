"use client";

import { ArrowRight } from "lucide-react";
import { useId, type ReactNode } from "react";
import { RollingNumber } from "@/components/cc/motion";

/**
 * A card docked at the scene's edge (v4 ADR-0099 Decision 3): Decide, Know and Board are this one component. Its title opens it in
 * place; the count is v4's, rolled in when it changes (the motion kit's RollingNumber), and a card with nothing in it says so.
 */
export function DockCard({ title, count, countLine, children, action, onOpen, className }: {
  title: string;
  count: number;
  /** The count in words, read by assistive tech and shown under the number. */
  countLine: string;
  children?: ReactNode;
  action: string;
  onOpen: () => void;
  className?: string | undefined;
}) {
  const id = useId();
  return (
    <section className={`dock-card ${count === 0 ? "is-quiet" : ""} ${className ?? ""}`} aria-labelledby={id}>
      <header className="dock-card-head">
        <h2 id={id}><button type="button" className="dock-card-title" onClick={onOpen}>{title}</button></h2>
        <span className="dock-card-count" aria-hidden="true"><RollingNumber value={count} /></span>
      </header>
      <p className="dock-card-line">{countLine}</p>
      {children}
      <button type="button" className="dock-card-action" onClick={onOpen}>{action} <ArrowRight size={14} aria-hidden="true" /></button>
    </section>
  );
}
