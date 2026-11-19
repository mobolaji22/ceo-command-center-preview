import type { MediaStudioView } from "./media-studio.generated";

/**
 * v4's Media studio (dev-playbook-v4 ADR-0081 Decision 13), as the studio reads and edits it. The shapes are v4's, generated from the
 * schema it publishes (`npm run v4:types`); this file only names their parts and holds the edits the studio makes to a timeline.
 * Each edit keeps v4's rules so a save is not refused for a reason the person could not see: beats run end to end, every moment
 * stays inside the piece, keyframes stay in order, a named motion keeps to its range. Whether an element may move at all is v4's
 * to say (a locked element is Design's), so no edit here decides it.
 */
export type { MediaStudioView };
export type MediaStudioPiece = MediaStudioView["pieces"][number];
export type MediaTimeline = MediaStudioPiece["timeline"];
export type MediaStudioRender = MediaStudioPiece["renders"][number];
export type MediaStudioCheck = MediaStudioRender["checks"][number];
export type MediaStudioFrame = NonNullable<MediaStudioView["design"]>["frames"][number];
export type MediaStudioNode = MediaStudioFrame["nodes"][number];
export type MediaOutput = MediaTimeline["outputs"][number];
export type MediaBeat = MediaTimeline["beats"][number];
export type MediaTrack = MediaTimeline["tracks"][number];
export type MediaTransition = MediaTimeline["transitions"][number];
export type MediaPresetRange = MediaStudioView["presets"]["node"][number];
export type NodePreset = NonNullable<MediaTrack["preset"]>;
export type TransitionPreset = MediaTransition["preset"];

/** Still formats name one moment; the others play the whole piece. */
export const isStill = (o: Pick<MediaOutput, "format">) => o.format === "png" || o.format === "jpg";

/** The output sizes the studio offers, by the shape a person asks for. A person can still type any size v4 accepts. */
export const OUTPUT_SHAPES = [
  { label: "16:9", width: 1920, height: 1080 },
  { label: "1:1", width: 1080, height: 1080 },
  { label: "4:5", width: 1080, height: 1350 },
  { label: "9:16", width: 1080, height: 1920 },
] as const;

const asTuple = <T,>(items: T[]): [T, ...T[]] => items as [T, ...T[]];

/** Every moment of the piece moved by one rule, the end included; keyframes stay strictly in order after rounding. */
function retime(t: MediaTimeline, at: (ms: number) => number): MediaTimeline {
  const r = (ms: number) => Math.max(0, Math.round(at(ms)));
  const ordered = <K extends { atMs: number }>(keys: K[]): K[] => {
    let last = -1;
    return keys.map((k) => { const atMs = Math.max(r(k.atMs), last + 1); last = atMs; return { ...k, atMs }; });
  };
  const durationMs = r(t.durationMs);
  return {
    ...t, durationMs,
    beats: asTuple(t.beats.map((b) => ({ ...b, startMs: r(b.startMs), endMs: r(b.endMs) }))),
    outputs: asTuple(t.outputs.map((o) => ({ ...o, atMs: o.atMs === null ? null : Math.min(durationMs, r(o.atMs)) }))),
    tracks: t.tracks.map((k) => ({ ...k, startMs: k.startMs === null ? null : r(k.startMs), keyframes: ordered(k.keyframes) })),
    camera: ordered(t.camera),
  };
}

/**
 * A beat made longer or shorter: what happens inside it stretches with it, and everything after it moves by the difference, so the
 * piece keeps its shape. Lengths are whole milliseconds, at least a tenth of a second.
 */
export function setBeatLength(t: MediaTimeline, beatId: string, lengthMs: number): MediaTimeline {
  const beat = t.beats.find((b) => b.id === beatId);
  if (!beat) return t;
  const length = Math.max(100, Math.round(lengthMs));
  const was = beat.endMs - beat.startMs;
  const k = length / was;
  const delta = length - was;
  return retime(t, (ms) => (ms <= beat.startMs ? ms : ms <= beat.endMs ? beat.startMs + (ms - beat.startMs) * k : ms + delta));
}

/** How one element moves: a named motion from the shared list, when it starts and how long it takes; null takes the motion off. */
export function setTrack(t: MediaTimeline, nodeId: string, motion: { preset: NodePreset; startMs: number; durationMs: number } | null): MediaTimeline {
  const others = t.tracks.filter((k) => k.nodeId !== nodeId);
  if (!motion) return { ...t, tracks: others };
  const startMs = Math.max(0, Math.min(t.durationMs, Math.round(motion.startMs)));
  const track: MediaTrack = { nodeId, preset: motion.preset, startMs, durationMs: Math.round(motion.durationMs), keyframes: [] };
  const at = t.tracks.findIndex((k) => k.nodeId === nodeId);
  return { ...t, tracks: at < 0 ? [...others, track] : t.tracks.map((k) => (k.nodeId === nodeId ? track : k)) };
}

/** How one beat hands over to the next: a named transition and its length; a cut has none. */
export function setTransition(t: MediaTimeline, fromBeatId: string, preset: TransitionPreset, durationMs: number): MediaTimeline {
  const i = t.beats.findIndex((b) => b.id === fromBeatId);
  const to = t.beats[i + 1];
  if (i < 0 || !to) return t;
  const x: MediaTransition = { fromBeatId, toBeatId: to.id, preset, durationMs: preset === "cut" ? 0 : Math.round(durationMs), easing: null };
  const has = t.transitions.some((tr) => tr.fromBeatId === fromBeatId);
  return { ...t, transitions: has ? t.transitions.map((tr) => (tr.fromBeatId === fromBeatId ? x : tr)) : [...t.transitions, x] };
}

/** One output's size, format, or a still's moment. */
export function setOutput(t: MediaTimeline, outputId: string, change: Partial<Pick<MediaOutput, "width" | "height" | "format" | "atMs">>): MediaTimeline {
  return {
    ...t,
    outputs: asTuple(t.outputs.map((o) => {
      if (o.id !== outputId) return o;
      const next = { ...o, ...change };
      // A still names its moment; a video plays the whole piece.
      return { ...next, atMs: isStill(next) ? Math.min(t.durationMs, Math.round(next.atMs ?? 0)) : null };
    })),
  };
}

export const seconds = (ms: number) => `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : ms % 100 === 0 ? 1 : 2)} s`;
