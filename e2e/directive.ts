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

/**
 * The directive desk lists requests by what they need (Needs you, In progress, Closed, All) and opens one at a time (P6.21). Opens
 * the request whose text matches, from the All tab, and returns its page; `part` picks its tab ("What it asks" or "The plan").
 */
export async function openDirective(page: Page, text: string | RegExp, part?: "What it asks" | "The plan") {
  const detail = page.locator(".directive-detail");
  // Just sent: the form closes onto the request it made once v4 has answered; wait for that rather than racing it.
  await expect(page.getByLabel("New request")).toHaveCount(0, { timeout: 30_000 });
  // The desk then opens that request after the next read, a moment later. Checking only once raced it: the list's tabs were
  // clicked as the request opened over them (detached), or were already gone. So it is given that moment first.
  const head = detail.locator(".directive-detail-head h3", { hasText: text });
  const already = await head.first().waitFor({ timeout: 5_000 }).then(() => true, () => false);
  if (!already) {
    if (await detail.count()) await page.getByRole("button", { name: "ALL DIRECTIVES" }).click();
    await page.getByRole("tab", { name: /^All/ }).click();
    await page.locator(".directive-row", { hasText: text }).first().click();
  }
  await expect(detail.locator(".directive-detail-head h3", { hasText: text })).toBeVisible();
  if (part) await detail.getByRole("tab", { name: new RegExp(`^${part}`) }).click();
  return detail;
}
