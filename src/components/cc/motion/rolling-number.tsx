"use client";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * A figure whose digits roll to their new value instead of swapping (a count, a total, a time). Each digit is a strip of 0 to 9
 * moved by a transform, so a change costs no layout and an interrupted roll simply turns towards the newest value. Slots are
 * keyed from the right, so the units stay the units when the figure gains or loses a digit. Anything that is not a digit (a
 * currency sign, a comma, a colon) is shown as written. Assistive tech reads the whole value once, not ten digits per slot.
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
          if (d < 0) return <span key={`s${key}`} className="roll-sign">{c}</span>;
          return (
            <span key={`d${key}`} className="roll-slot">
              <span className="roll-strip" style={{ transform: `translateY(${d * -10}%)` }}>
                {DIGITS.map((n) => <span key={n}>{n}</span>)}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
