import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests, seedGuidedStep } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";

/**
 * The agency's team (v4 ADR-0072). The CEO invites a team member and gives them a job role covering the hosted-store setup, each
 * change behind a fresh code. The member signs in from the invitation and lands on their own page: the steps their role covers,
 * with the guide, and nothing of the CEO's office.
 */
const CEO = "ceo@agency.example";
const MEMBER = "builder@agency.example";

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

evidence(test);
test.beforeEach(() => forgetSignInRequests());

test("the CEO gives a team member a job role, and the member sees only the steps it covers", async ({ page, browser }) => {
  const q = seedGuidedStep(CEO);
  await signIn(page, CEO);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.getByRole("tab", { name: "Team", exact: true }).click();
  await expect(settings.getByText("No roles yet, so every person's step comes to you.")).toBeVisible();

  // Inviting asks for a fresh code first.
  await settings.getByRole("form", { name: "Invite a team member" }).getByLabel("Team member's email").fill(MEMBER);
  const asked = mailCount();
  await settings.getByRole("button", { name: "Invite", exact: true }).click();
  const form = settings.getByRole("form", { name: "Confirm it's you" });
  const code = await mailTo(CEO, "step-up", asked);
  await form.getByPlaceholder("Six-digit code").fill(code.meta!.code!);
  await form.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(settings.getByRole("status")).toHaveText(`Invitation sent to ${MEMBER}.`);

  // The member accepts in another browser and lands on their own page, with nothing on it yet.
  const invite = await mailTo(MEMBER, "invitation");
  const memberCtx = await browser.newContext();
  const member = await memberCtx.newPage();
  await member.goto(invite.meta!.link!);
  await member.getByRole("button", { name: "Accept invitation" }).click();
  await expect(member.getByRole("heading", { name: "Your steps" })).toBeVisible();
  await expect(member.getByText("Nothing is waiting for an answer.")).toBeVisible();

  // A role covering the store setup, given to the member.
  // Settings reopens on its own after a reload, so close it and open it again to read the team afresh.
  await settings.getByRole("button", { name: "BACK TO OFFICE" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await settings.getByRole("tab", { name: "Team", exact: true }).click();
  await expect(settings.getByRole("list", { name: "Team members" })).toContainText(MEMBER);
  await settings.getByLabel("Role name").fill("Store setup");
  await settings.getByRole("group", { name: "The work it covers" }).getByRole("checkbox").first().check();
  await settings.getByRole("button", { name: "Add the role" }).click();
  await expect(settings.getByRole("status")).toHaveText('"Store setup" added.');
  // The box shows what v4 holds, so it ticks once the grant is saved, not on the click.
  const holds = settings.getByRole("group", { name: "Who holds Store setup" }).getByRole("checkbox", { name: MEMBER });
  await holds.click();
  await expect(settings.getByRole("status")).toContainText("now holds Store setup.");
  await expect(holds).toBeChecked();
  await shot(page, "Settings › Team: a team member holds the Store setup role");

  // The member now sees the step, its guide and what it applies, and can log it; stopping the run is not theirs.
  await member.reload();
  const card = member.getByRole("article", { name: q.title }).first();
  await expect(card.getByLabel("Step-by-step guide")).toContainText("of 9 steps done");
  await expect(card.getByLabel("What this step applies")).toBeVisible();
  await expect(card.getByRole("button", { name: "Stop the work" })).toHaveCount(0);
  const account = card.getByRole("listitem", { name: "Open the store account in the client's name" });
  await account.getByRole("button", { name: "Open the store account in the client's name" }).click();
  await account.getByRole("button", { name: "Done" }).click();
  await account.getByLabel("What was done?").fill("Account opened in the client's name; I have a staff login");
  await account.getByRole("button", { name: "Log it" }).click();
  await expect(account.locator(".pill")).toHaveText("DONE");
  await shot(member, "A team member's page: the step their role covers, with its guide");

  // The CEO's office is not theirs.
  await member.goto("/");
  await member.waitForURL((u) => u.pathname === "/team");
  await memberCtx.close();
});
