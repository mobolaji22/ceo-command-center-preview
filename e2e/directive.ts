import { expect, type Page } from "@playwright/test";

/**
 * On the Directive desk the work comes first; a new directive starts a new project, from a button that opens the form (P6.21,
 * v4 ADR-0078). Returns the form.
 */
export async function newDirective(page: Page) {
  const open = page.getByRole("button", { name: "New project", exact: true });
  const composer = page.getByLabel("New request");
  // The desk may still be opening: wait for either the button or the form before deciding which it is.
  await expect(open.or(composer)).toBeVisible();
  if (await open.isVisible()) await open.click();
  await expect(composer).toBeVisible();
  return composer;
}

/**
 * Projects and their threads (v4 ADR-0078), the same screen on the CEO's directive desk and the client's board: the threads listed
 * by project, and one open at a time. Opens the thread whose title matches, from "All threads", and returns it; `part` picks its
 * tab ("Conversation", "What it asks" or "The plan"). Works for the client too.
 */
export async function openDirective(page: Page, text: string | RegExp, part?: "Conversation" | "What it asks" | "The plan") {
  const detail = page.locator(".directive-detail");
  // Just sent: the form closes onto the request it made once v4 has answered; wait for that rather than racing it.
  await expect(page.getByLabel("New request")).toHaveCount(0, { timeout: 30_000 });
  // The desk then opens that request after the next read, a moment later. Checking only once raced it: the list's tabs were
  // clicked as the request opened over them (detached), or were already gone. So it is given that moment first.
  const head = detail.locator(".directive-detail-head h3", { hasText: text });
  const already = await head.first().waitFor({ timeout: 5_000 }).then(() => true, () => false);
  if (!already) {
    // On a phone the list and the open thread take turns.
    const back = page.getByRole("button", { name: "ALL THREADS" });
    if (await back.isVisible()) await back.click();
    await page.getByRole("tab", { name: /^All threads/ }).click();
    await page.locator(".thread-row", { hasText: text }).first().click();
  }
  await expect(detail.locator(".directive-detail-head h3", { hasText: text })).toBeVisible();
  if (part) await detail.getByRole("tab", { name: new RegExp(`^${part}`) }).click();
  return detail;
}
