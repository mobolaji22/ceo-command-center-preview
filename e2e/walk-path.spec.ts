import { expect, test } from "@playwright/test";
import { coverScale, walkAt, walkPath, type WalkInput } from "../src/lib/walk-path";

/**
 * The lobby's walk to the rooms (src/lib/walk-path.ts), checked without a browser. The passage is near the photograph's left edge,
 * so the camera must zoom as it pans or the picture slides off the screen; and it must move smoothly, without jumps.
 */
const cases: Array<[string, WalkInput]> = [
  // 1440x900 desktop: the frame is wider than the screen and shifted left (the passage ends up 14px from the left edge).
  ["desktop", { viewport: { width: 1440, height: 900 }, origin: { x: -156, y: 0 }, passage: { x: 14, y: 441 }, photo: { left: -188, top: -18, right: 1469, bottom: 918 }, endScale: 3.6 }],
  // 390x844 phone, as measured: the picture fills the band above the card (to 534px), the passage far off to the left.
  ["phone", { viewport: { width: 390, height: 534 }, origin: { x: -509, y: 0 }, passage: { x: -424, y: 256 }, photo: { left: -528, top: -10, right: 436, bottom: 534 }, endScale: 3.6 }],
];

for (const [name, input] of cases) {
  test(`${name}: the photograph covers the screen at every step of the walk`, () => {
    for (let n = 0; n <= 200; n++) {
      const u = n / 200;
      const { scale, tx, ty } = walkAt(input, u);
      const map = (x: number, o: number, t: number) => o + t + scale * (x - o);
      expect(map(input.photo.left, input.origin.x, tx)).toBeLessThanOrEqual(0.5);
      expect(map(input.photo.right, input.origin.x, tx)).toBeGreaterThanOrEqual(input.viewport.width - 0.5);
      expect(map(input.photo.top, input.origin.y, ty)).toBeLessThanOrEqual(0.5);
      expect(map(input.photo.bottom, input.origin.y, ty)).toBeGreaterThanOrEqual(input.viewport.height - 0.5);
    }
  });

  test(`${name}: it arrives with the passage in the middle, zoomed in, and the zoom never backs off`, () => {
    const end = walkAt(input, 1);
    expect(end.at.x).toBeCloseTo(input.viewport.width / 2, 3);
    expect(end.at.y).toBeCloseTo(input.viewport.height / 2, 3);
    expect(end.scale).toBeGreaterThanOrEqual(Math.max(input.endScale, coverScale(input, end.at)) - 1e-9);
    let last = 0;
    for (let n = 0; n <= 200; n++) {
      const s = walkAt(input, n / 200).scale;
      expect(s).toBeGreaterThanOrEqual(last - 1e-9);
      last = s;
    }
  });

  test(`${name}: no jumps; the camera's speed changes gradually, frame to frame`, () => {
    // 99 steps over the 1.65s walk is about one step per frame at 60fps.
    const frames = walkPath({ ...input, steps: 99 }).map((f) => f.transform.match(/-?\d+(\.\d+)?/g)!.map(Number) as [number, number, number]);
    // Track what the eye follows: the passage on screen (pan) and the zoom in proportional terms.
    const at = frames.map(([tx, ty, s]) => [input.origin.x + tx + s * (input.passage.x - input.origin.x), input.origin.y + ty + s * (input.passage.y - input.origin.y), Math.log(s)] as const);
    const v = at.slice(1).map((p, n) => [p[0] - at[n]![0], p[1] - at[n]![1], p[2] - at[n]![2]] as const);
    const peakPan = Math.max(...v.map((d) => Math.hypot(d[0], d[1])));
    const peakZoom = Math.max(...v.map((d) => Math.abs(d[2])));
    for (let n = 1; n < v.length; n++) {
      // A jump is speed changing abruptly: no frame may change the pan or zoom speed by more than a sixth of their peak.
      expect(Math.hypot(v[n]![0] - v[n - 1]![0], v[n]![1] - v[n - 1]![1])).toBeLessThan(peakPan / 6);
      expect(Math.abs(v[n]![2] - v[n - 1]![2])).toBeLessThan(peakZoom / 6);
    }
    // And never faster than a tenth of the stage per frame, or a 6% zoom per frame.
    expect(peakPan / input.viewport.width).toBeLessThan(0.1);
    expect(Math.exp(peakZoom)).toBeLessThan(1.06);
  });
}
