/**
 * Someone is at work on the person's behalf (the agency writing its reply). Three dots that breathe in turn, with the words
 * beside them; assistive tech hears the words once, as a status, and nothing repeats.
 */
export function Presence({ label, className }: { label: string; className?: string | undefined }) {
  return (
    <span className={`presence${className ? ` ${className}` : ""}`} role="status">
      <span className="presence-dots" aria-hidden="true"><i /><i /><i /></span>
      <span className="presence-label">{label}</span>
    </span>
  );
}
