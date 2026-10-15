import { expect, type Locator } from "@playwright/test";

/**
 * Answers whatever a request still asks, until nothing is asked. For tests about the flow, not about which questions v4 asks
 * (the v4 repo's own tests cover those). Where a preferred answer is offered it is chosen, so the plan keeps the shape the later
 * tests expect (the current direction, no compliance duty); otherwise the first offered answer. Answering may bring the next
 * question in.
 */
const PREFER = [/^Keep the current direction/, /^No, none applies/];

export async function answerEveryQuestion(card: Locator) {
  const planned = card.locator(".intent-head .pill", { hasText: "PLANNED" });
  for (let asked = 0; asked < 10; asked++) {
    // Wait until the card has settled on asking or planned: questions arrive with the card, and the next may follow an answer.
    await expect(card.locator(".question").first().or(planned)).toBeVisible();
    const question = card.locator(".question").first();
    if (!(await question.count())) return;
    const asking = (await question.getAttribute("aria-label")) ?? "";
    const offered = question.locator(".options button.option");
    let chosen = offered.first();
    for (const p of PREFER) {
      const match = offered.filter({ hasText: p });
      if (await match.count()) { chosen = match.first(); break; }
    }
    await chosen.click();
    await expect(card.locator(".question").filter({ hasText: asking })).toHaveCount(0);
  }
  throw new Error("The request kept asking");
}
