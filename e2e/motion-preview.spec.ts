import { expect, test } from "@playwright/test";

/**
 * The small answers (src/components/cc/motion), on their preview page, which reads no records and needs no sign-in. What is
 * checked is what a person relies on, not how it looks in flight: a figure says its new value, a button reports "done" only after
 * the answer and says why when there is none, a dealt-with item leaves the list, and with motion switched off every one of those
 * still happens while nothing on the page is moving.
 */
test.describe("motion preview", () => {
  test("each piece reaches its new state, and says so", async ({ page }) => {
    await page.goto("/motion");
    const waiting = page.locator(".mo-figure").first().locator(".roll .sr-only");
    await expect(waiting).toHaveText("3");
    await page.getByRole("button", { name: "One more" }).click();
    await expect(waiting).toHaveText("4");

    // The highlight is the row's own: it sits under the chosen tab, and moves when another is chosen.
    const tabs = page.getByRole("tablist");
    const markAt = () => tabs.evaluate((row) => getComputedStyle(row).getPropertyValue("--slide-l"));
    const before = await markAt();
    await page.getByRole("tab", { name: "Security/Gov" }).click();
    await expect.poll(markAt).not.toBe(before);

    // "Done" is not claimed while the answer is still out.
    const approve = page.getByRole("button", { name: /Approve authorization/ });
    await approve.click();
    await expect(approve).toHaveAttribute("data-phase", "working");
    await expect(approve).toHaveAttribute("aria-busy", "true");
    await expect(approve).toHaveAttribute("data-phase", "done");
    await expect(page.getByRole("status").filter({ hasText: /^Approved$/ })).toHaveCount(1);
    await expect(approve).toHaveAttribute("data-phase", "idle", { timeout: 5000 });

    // A failure keeps the button as it was and gives the reason, on screen and to assistive tech.
    const sign = page.getByRole("button", { name: /this one fails/ });
    await sign.click();
    await expect(sign).toHaveAttribute("data-phase", "failed");
    await expect(page.getByRole("alert").filter({ hasText: "Nothing was signed" })).toBeVisible();

    // A dealt-with item leaves once its tick has been seen, and the count follows.
    // The row that is closing up is out of reach and unannounced, so the list reads as three while it does.
    const rows = page.locator(".mo-queue").getByRole("listitem");
    await expect(rows).toHaveCount(4);
    await rows.first().getByRole("button").click();
    await expect(rows).toHaveCount(3, { timeout: 6000 });
    await expect(page.locator(".mo-queue .ranks-item")).toHaveCount(3);
    // A new one opens its own space at the foot.
    await page.getByRole("button", { name: /A NEW ONE ARRIVES/ }).click();
    await expect(rows).toHaveCount(4);
    await expect(rows.last()).toContainText("Review the proposal draft");

    await page.getByRole("button", { name: /Copy the link/ }).click();
    await expect(page.locator(".confirm-note")).toHaveText(/Link copied/);
  });

  test("with motion off, the same changes happen and nothing moves", async ({ page }) => {
    await page.goto("/motion");
    await page.getByRole("button", { name: "Motion off" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await page.getByRole("button", { name: "One more" }).click();
    await page.getByRole("tab", { name: "Decision Ledger" }).click();
    await page.getByRole("button", { name: "Use more" }).click();
    await page.getByRole("checkbox").nth(1).click();
    await page.getByRole("button", { name: /Aromatherapy store/ }).last().click();
    await expect(page.getByRole("heading", { name: "Aromatherapy store" })).toBeVisible();
    await expect(page.locator(".mo-figure").first().locator(".roll .sr-only")).toHaveText("4");
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length), "nothing is animating").toBe(0);
    // The choice is the person's, and is still theirs after a reload.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await page.getByRole("button", { name: "Follow my device" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-motion", "off");
  });
});
