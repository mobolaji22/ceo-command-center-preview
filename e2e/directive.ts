import { expect, type Page } from "@playwright/test";

/**
 * On the Directive desk the work comes first; a new directive is a button that opens the form (P6.21). With nothing asked yet the
 * form is already open. Returns the form.
 */
export async function newDirective(page: Page) {
  const open = page.getByRole("button", { name: "New directive", exact: true });
  if (await open.isVisible()) await open.click();
  const composer = page.getByLabel("New request");
  await expect(composer).toBeVisible();
  return composer;
}
