import { expect, type Locator, type Page } from "@playwright/test";

/**
 * How a CEO reaches each place from the studio (v4 ADR-0099; the office home of 2026-11-27), the way a person would: Decide, Know and
 * Board are parked on the bottom edge and rise when their tab is pressed, the Floor is behind Board with the records beside it, and
 * the studio head offers "Your requests". One helper, so a spec says where it goes, not how.
 */
export const studioHeading = (page: Page) => page.getByRole("heading", { name: "The studio", exact: true });

export type StudioCard = "Decide" | "Know" | "Board";

/** A parked card, by its name: the region its tab names. */
export const parkedCard = (page: Page, name: StudioCard): Locator => page.getByRole("region", { name, exact: true });

/** Raises a parked card if it is not already up, and returns it. */
export async function raiseCard(page: Page, name: StudioCard): Promise<Locator> {
  const card = parkedCard(page, name);
  const tab = card.getByRole("button").first();
  if ((await tab.getAttribute("aria-expanded")) !== "true") await tab.click();
  await expect(tab).toHaveAttribute("aria-expanded", "true");
  return card;
}

export type StudioPlace = "sign" | "brief" | "floor" | "detail" | "requests" | "records";

export async function openFromStudio(page: Page, place: StudioPlace) {
  await expect(studioHeading(page)).toBeVisible();
  if (place === "sign") return (await raiseCard(page, "Decide")).getByRole("button", { name: "Everything to sign" }).click();
  if (place === "brief") return (await raiseCard(page, "Know")).getByRole("button", { name: "Read what changed" }).click();
  if (place === "requests") return page.getByRole("button", { name: "Your requests" }).click();
  await (await raiseCard(page, "Board")).getByRole("button", { name: "Walk the Floor" }).click();
  if (place === "detail") await page.getByRole("button", { name: "Work in detail" }).click();
  // The records sit with the Floor until they become a room's shelf (4.3).
  if (place === "records") await page.getByRole("button", { name: "Records", exact: true }).click();
}
