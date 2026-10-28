import { expect, type Page } from "@playwright/test";

/**
 * The client room is a photograph with five objects to press; each opens a desk with its information in tabs. These helpers stand
 * in the room, open a desk (and one of its tabs), and are safe to call again after a reload. A reload reopens the desk the address
 * names (`?desk=`), so they first wait for that desk to be back before deciding whether to move.
 */
export type ClientDesk = "Table" | "Screen" | "Board" | "Shelf" | "Lamp";
const HEADING: Record<ClientDesk, string> = { Table: "Your projects", Screen: "Decisions", Board: "Requests", Shelf: "Library", Lamp: "Briefs" };

export async function openClientDesk(page: Page, desk: ClientDesk, tab?: string | RegExp) {
  const frame = page.locator("[data-desk]");
  if (new URL(page.url()).searchParams.get("desk")) await expect(frame.first()).toBeVisible();
  const inDesk = (await frame.count()) > 0;
  const here = inDesk && (await page.locator(".desk-heading h2").innerText()).startsWith(HEADING[desk]);
  if (!here) {
    if (inDesk) await page.getByRole("button", { name: "BACK TO ROOM" }).click();
    // Pressing an object goes straight in; the preview is only for hovering.
    await page.getByRole("button", { name: desk, exact: true }).click();
    await expect(page.locator(".desk-heading h2")).toContainText(HEADING[desk]);
  }
  if (tab) await page.getByRole("tab", { name: tab }).click();
}

/** The table shows one project at a time; this opens the Projects desk and chooses the one whose name matches. */
export async function openClientProject(page: Page, name: RegExp) {
  await openClientDesk(page, "Table");
  await page.getByRole("tab", { name: /^Projects/ }).click();
  const chip = page.locator(".desk-chip", { hasText: name });
  if (await chip.count()) await chip.first().click();
}

/**
 * On the board a client's requests come first; writing a new one is a button that opens the form (P6.21 P5). With nothing asked
 * yet the form is already open. Returns the form.
 */
export async function newClientRequest(page: Page) {
  const open = page.getByRole("button", { name: "New request", exact: true });
  if (await open.isVisible()) await open.click();
  const composer = page.getByLabel("New request");
  await expect(composer).toBeVisible();
  return composer;
}
