/**
 * The studio head's portrait until the brand's imagery holds one (v4 ADR-0099 Decision 2; the image brief names it): a head and
 * shoulders drawn in the theme's ink and paper, so it takes any agency's colours. When the record carries a portrait, that replaces it.
 */
export function StudioPortrait() {
  return (
    <svg className="studio-portrait" viewBox="14 9 92 92" aria-hidden="true" focusable="false" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
      <rect x="0" y="0" width="120" height="120" className="sp-ground" />
      <path className="sp-ink-fill" d="M8 120c3-17 13-25 30-29l14-5 8 9 8-9 14 5c17 4 27 12 30 29z" />
      <path className="sp-paper-fill" d="M52 86l8 9 8-9 3 4-11 16-11-16z" />
      <path className="sp-paper-line" d="M60 95v25" />
      <path className="sp-soft-line" d="M44 89l9 19M76 89l-9 19" />
      <path className="sp-face" d="M51 73v12c3 3 15 3 18 0V73" />
      <path className="sp-face" d="M39.5 50c0 17 8.5 28.5 20.5 28.5S80.5 67 80.5 50" />
      <path className="sp-face" d="M40 48c-4-1-6 2-5 6s3 6 6 6M80 48c4-1 6 2 5 6s-3 6-6 6" />
      <path className="sp-ink-fill" d="M38.5 52c-3-19 7-31 21.5-31s24.5 12 21.5 31c-2-7-5-11-9-13-7 3-18 3-25 0-4 2-7 6-9 13z" />
      <path className="sp-line" strokeWidth={1.8} d="M46 50.5c3-1.6 6-1.8 9-.6M65 49.9c3-1.2 6-1 9 .6" />
      <path className="sp-ink-fill sp-line" d="M47 56.5c2.2-1.8 5-1.8 7 0-2 1.4-5 1.4-7 0zM66 56.5c2.2-1.8 5-1.8 7 0-2 1.4-5 1.4-7 0z" />
      <path className="sp-line" d="M60 58.5c-.5 3-1.5 6-3 8 1.5 1 4 1 6 0" />
      <path className="sp-line" d="M53.5 71.5c4 2.4 9 2.4 13-.4" />
    </svg>
  );
}
