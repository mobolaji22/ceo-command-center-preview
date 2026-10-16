/**
 * The camera's path for the walk from the lobby to the rooms (lobby.tsx). The passage beside "Rooms 01-13" is near the photograph's
 * left edge, so panning it to the middle of the screen alone would slide the picture off and show the empty space past its edge.
 *
 * The path is found in the photograph, not on the screen: the part of it the screen shows (the window) starts as what is on screen
 * now and ends as a small window centred on the passage. Each edge of the window slides from where it starts to where it ends on
 * one ease-in-out curve. Both windows are inside the photograph, so every window between them is too: the photograph covers the
 * screen throughout without anything pushing the camera back, and the camera never brakes or lurches. It is a dolly: the camera
 * turns toward the passage and walks into it in one movement.
 *
 * Everything is in screen pixels, measured once when the walk starts. The result is keyframes for one element whose transform
 * origin is the frame's top-left corner, so the whole walk is a single composited transform.
 */
export type Box = { left: number; top: number; right: number; bottom: number };
export type WalkInput = {
  /** The stage the photograph fills, from the screen's top-left: the whole screen, or on a phone the band above the card. */
  viewport: { width: number; height: number };
  /** The frame's top-left corner on screen: the walking element's transform origin. */
  origin: { x: number; y: number };
  /** Where the passage is on screen before the walk. */
  passage: { x: number; y: number };
  /** Where the photograph is on screen before the walk. */
  photo: Box;
  /** How far the camera has zoomed in when it arrives (at least as far as covering the screen needs). */
  endScale: number;
  /** Samples along the path; the browser interpolates linearly between them. */
  steps?: number;
};
export type WalkFrame = { transform: string; offset: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** The smallest zoom (about the passage, with the passage at `at`) at which the photograph still covers the screen. */
export function coverScale(i: WalkInput, at: { x: number; y: number }): number {
  const { width, height } = i.viewport;
  const p = i.passage;
  return Math.max(
    1,
    at.x / Math.max(1, p.x - i.photo.left),
    (width - at.x) / Math.max(1, i.photo.right - p.x),
    at.y / Math.max(1, p.y - i.photo.top),
    (height - at.y) / Math.max(1, i.photo.bottom - p.y),
  );
}

/** Where the camera is at `u` (0 to 1 along the walk): the passage's place on screen, the zoom and the element's translation. */
export function walkAt(i: WalkInput, u: number): { at: { x: number; y: number }; scale: number; tx: number; ty: number } {
  const { width, height } = i.viewport;
  const p = i.passage;
  const endScale = Math.max(i.endScale, coverScale(i, { x: width / 2, y: height / 2 }));
  // The windows, in screen pixels as they were before the walk: the stage now, and the stage shrunk by the end zoom about the passage.
  const from = { left: 0, top: 0, right: width };
  const to = { left: p.x - width / 2 / endScale, top: p.y - height / 2 / endScale, right: p.x + width / 2 / endScale };
  const k = easeInOutCubic(clamp01(u));
  const left = lerp(from.left, to.left, k);
  const top = lerp(from.top, to.top, k);
  const scale = width / (lerp(from.right, to.right, k) - left);
  // The element scales about the frame's corner: a point at screen x moves to origin + t + scale * (x - origin). The window's
  // corner must land on the stage's corner.
  const tx = scale * (i.origin.x - left) - i.origin.x;
  const ty = scale * (i.origin.y - top) - i.origin.y;
  return { at: { x: scale * (p.x - left), y: scale * (p.y - top) }, scale, tx, ty };
}

export function walkPath(i: WalkInput): WalkFrame[] {
  const steps = i.steps ?? 60;
  return Array.from({ length: steps + 1 }, (_, n) => {
    const { scale, tx, ty } = walkAt(i, n / steps);
    return { offset: n / steps, transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${scale.toFixed(4)})` };
  });
}
