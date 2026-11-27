import { COPY, say } from "@/copy";

/**
 * A station's pin (v4 ADR-0099 Decision 1): what needs the person first, then what is held, then what is at work. A pin with nothing to
 * say is quiet, not zero. The counts are v4's `StationView`; the words are the copy file's.
 */
export function pinWords(s: { needsYou: number; live: number; held: number }): string[] {
  const w = COPY.studio.station;
  const out: string[] = [];
  if (s.needsYou) out.push(say(w.needsYou, { count: s.needsYou }));
  if (s.held) out.push(say(w.held, { count: s.held }));
  if (s.live) out.push(say(w.live, { count: s.live }));
  return out.length ? out : [w.quiet];
}

export function Pin({ needsYou, live, held }: { needsYou: number; live: number; held: number }) {
  const words = pinWords({ needsYou, live, held });
  const tone = needsYou ? "needs" : held ? "held" : live ? "live" : "quiet";
  return <span className={`station-pin station-pin-${tone}`}>{words.map((w) => <span key={w} className="station-pin-line">{w}</span>)}</span>;
}
