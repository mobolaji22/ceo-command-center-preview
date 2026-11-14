import type { ReactNode } from "react";

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * A bar that fills to its value and eases to a new one (a budget used, a plan's progress). The fill is one element scaled from
 * the left, so a change costs no layout. `tone` colours it where the number means something (close to, or over, a limit).
 */
export function Meter({ value, label, tone, className }: { value: number; label: string; tone?: "high" | "full" | undefined; className?: string | undefined }) {
  const v = clamp(value);
  return (
    <div className={`meter${className ? ` ${className}` : ""}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} data-tone={tone}>
      <i style={{ transform: `scaleX(${v / 100})` }} />
    </div>
  );
}

const R = 26;
const C = 2 * Math.PI * R;

/** The same, as a ring, with whatever belongs in its middle (a count of steps, a share). */
export function Ring({ value, label, size = 72, children }: { value: number; label: string; size?: number; children?: ReactNode }) {
  const v = clamp(value);
  return (
    <span className="dial" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 60 60" aria-hidden="true">
        <circle className="dial-track" cx="30" cy="30" r={R} />
        <circle className="dial-fill" cx="30" cy="30" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)} />
      </svg>
      {children !== undefined && <span className="dial-middle">{children}</span>}
    </span>
  );
}
