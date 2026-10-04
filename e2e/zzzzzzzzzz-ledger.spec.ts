import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";

/**
 * The Computer's Decision Ledger and Security/Gov tabs (CC) read the records: every plan decision with who made it, what the agency
 * may do without asking right now, and whether each client's audit chain is intact.
 */
const CEO = "ceo@agency.example";

async function signIn(page: Page, email: string) {
  const before = mailCount();
  await page.goto("/auth");
  await page.getByLabel("EMAIL").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  const mail = await mailTo(email, "sign-in", before);
  await page.goto(mail.meta!.link!);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

test.describe.configure({ mode: "serial" });
evidence(test);
test.beforeEach(() => forgetSignInRequests());

test("the ledger lists every plan decision with who made it, and the governance tab shows what is in force and that the chains are intact", async ({ page }) => {
  await signIn(page, CEO);
  await page.getByRole("button", { name: "Preview Computer" }).click();
  await page.getByRole("button", { name: "Open operating system" }).click();

  await page.getByRole("tab", { name: "Decision Ledger" }).click();
  const decisions = page.getByLabel("Plan decisions");
  await expect(decisions.locator(".dossier-row").first()).toBeVisible();
  await expect(decisions).toContainText("version");
  await expect(decisions.getByText("APPROVED").first()).toBeVisible();
  await expect(decisions).toContainText("The client's owner");
  // the CEO decided one for the client under their permission, and the ledger says so
  await expect(decisions).toContainText("The CEO, on the client's behalf");
  await shot(page, "The Decision Ledger: every plan decision and who made it");

  await page.getByRole("tab", { name: "Security/Gov" }).click();
  const chains = page.getByLabel("Audit chains");
  await expect(chains.locator(".dossier-row").first()).toBeVisible();
  await expect(chains.getByText("INTACT").first()).toBeVisible();
  await expect(chains.getByText("BROKEN")).toHaveCount(0);
  await expect(chains).toContainText("Orbit");
  await expect(chains).toContainText("sealed");
  await shot(page, "Security and governance: what may be done without asking, and each client's audit chain");
  // what is in force: the number in the heading is the number of rows, and with none the tab says every step asks first
  const heading = await page.getByText(/^\d+ IN FORCE$/).innerText();
  const n = Number(heading.split(" ")[0]);
  if (n === 0) await expect(page.getByText("Nothing is delegated: every step asks first.")).toBeVisible();
  else await expect(page.getByLabel("Delegations in force").locator(".dossier-row")).toHaveCount(n);
});
