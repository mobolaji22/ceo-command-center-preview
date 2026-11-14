import type { CSSProperties } from "react";

const DIGITS = "0123456789";

/**
 * A figure whose digits roll to their new value instead of swapping (a count, a total, a time). Each digit is a strip of 0 to 9
 * moved by a transform, so a change costs no layout and an interrupted roll simply turns towards the newest value. Slots are
 * keyed from the right, so the units stay the units when the figure gains or loses a digit.
 *
 * The strips are drawn by the stylesheet (generated content), not written into the page: the only text here is the value
 * itself, once. So the figure reads, copies, is found and is tested as the plain value, and assistive tech hears it once.
 */
export function RollingNumber({ value, className }: { value: number | string; className?: string | undefined }) {
  const text = String(value);
  const chars = [...text];
  return (
    <span className={className ? `roll ${className}` : "roll"}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="roll-row">
        {chars.map((c, i) => {
          const key = chars.length - i;
          const d = DIGITS.indexOf(c);
          return d < 0
            ? <span key={`s${key}`} className="roll-sign" data-c={c} />
            : <span key={`d${key}`} className="roll-slot" style={{ "--d": d } as CSSProperties} />;
        })}
      </span>
    </span>
  );
}
