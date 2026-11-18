/** A tick that is drawn, not shown: the stroke runs from its start to its end when the tick appears. */
export function Tick({ size = 16, className }: { size?: number; className?: string | undefined }) {
  return (
    <svg className={className ? `tick ${className}` : "tick"} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5l3.2 3.2L13 4.8" pathLength={1} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
