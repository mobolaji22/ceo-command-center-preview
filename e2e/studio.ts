import { expect, type Page } from "@playwright/test";

/**
 * How a CEO reaches each place from the studio (v4 ADR-0099, slice 4.2), the way a person would: the docked cards, the Floor behind
 * Board with the records beside it, and the composer's "Your requests". One helper, so a spec says where it goes, not how.
 */
export const studioHeading = (page: Page) => page.getByRole("heading", { name: "The studio", exact: true });

export type StudioPlace = "sign" | "brief" | "floor" | "detail" | "requests" | "records";

export async function openFromStudio(page: Page, place: StudioPlace) {
  await expect(studioHeading(page)).toBeVisible();
  if (place === "sign") return page.getByRole("button", { name: "Everything to sign" }).click();
  if (place === "brief") return page.getByRole("button", { name: "Read what changed" }).click();
  if (place === "requests") return page.getByRole("button", { name: "Your requests" }).click();
  await page.getByRole("button", { name: "Walk the Floor" }).click();
  if (place === "detail") await page.getByRole("button", { name: "Work in detail" }).click();
  // The records sit with the Floor until they become a room's shelf (4.3).
  if (place === "records") await page.getByRole("button", { name: "Records", exact: true }).click();
}
