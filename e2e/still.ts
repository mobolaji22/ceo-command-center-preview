import { expect, type Page } from "@playwright/test";

/**
 * P6.21 L: an open desk costs the room behind it nothing to draw. Once the desk has opened, nothing outside it is animating, and
 * no full-screen layer blurs what is behind it (a live full-screen blur is recomputed on every frame and held the Workshop near
 * 15 fps). Checked as facts about the page, not as a frame rate, which is too noisy to gate on.
 */
export async function expectRoomHeldStill(page: Page) {
  await expect(page.locator("html[data-desk-open]")).toHaveCount(1);
  const found = await page.evaluate(() => {
    const overlay = document.querySelector(".desk-overlay");
    const moving = document.getAnimations().filter((a) => {
      const target = (a.effect as KeyframeEffect | null)?.target;
      return a.playState === "running" && target instanceof Element && !overlay?.contains(target);
    }).map((a) => `${(a as CSSAnimation).animationName ?? "animation"} on ${String((a.effect as KeyframeEffect).target?.className).split(" ")[0]}`);
    const area = innerWidth * innerHeight;
    const blurs = [...document.querySelectorAll("body *")].filter((e) => {
      const r = e.getBoundingClientRect();
      return getComputedStyle(e).backdropFilter !== "none" && r.width * r.height > area * 0.5;
    }).map((e) => String(e.className).split(" ")[0]);
    return { moving, blurs };
  });
  expect(found.moving, "nothing behind an open desk animates").toEqual([]);
  expect(found.blurs, "no large layer blurs what is behind it").toEqual([]);
}
