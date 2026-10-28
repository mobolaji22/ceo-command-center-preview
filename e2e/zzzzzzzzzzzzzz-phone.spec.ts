import { expect, test, type Page } from "@playwright/test";
import { forgetSignInRequests } from "./db";
import { mailCount, mailTo } from "./outbox";
import { evidence, shot } from "./evidence";

/**
 * The phone (P6.21 P7): every desk, the CEO's and a client's, at two phone widths, held to what a phone needs instead of judged by
 * eye. The page never scrolls sideways; nothing sits off the screen except inside a scroller made for it; no text has something
 * drawn over it; and a desk's content starts right under its one bar. Runs last, after the journey has filled every desk.
 */
const CEO = "ceo@agency.example";
const OWNER = "owner@orbit.example";

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

/** What a phone screen must not do. The room behind an open desk is inert and hidden from the check, as it is from people. */
async function expectFitsThePhone(page: Page, where: string) {
  // A desk is checked once it has finished opening (desk-overlay.tsx marks that), not mid-animation.
  if (await page.locator(".desk-overlay").count()) await expect(page.locator("html[data-desk-open]")).toHaveCount(1);
  const found = await page.evaluate(() => {
    const W = innerWidth, H = innerHeight;
    const shown = (e: Element) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && !e.closest("[inert],[aria-hidden='true']"); };
    const inScroller = (e: Element) => { for (let p = e.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(s.overflowX) && p.scrollWidth > p.clientWidth) return true; } return false; };
    // Scrolled out of sight inside a scroller is not covered: a brief just past the bottom of the Lamp's list sits in the desk's
    // bottom margin, where the point under it is the scrim, so whether the check failed depended on how long the list happened to be.
    const clippedAt = (e: Element, x: number, y: number) => { for (let p = e.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.overflowX === "visible" && s.overflowY === "visible") continue; const c = p.getBoundingClientRect(); if (x < c.left || x > c.right || y < c.top || y > c.bottom) return true; } return false; };
    const all = [...document.querySelectorAll("body *")].filter(shown);
    const name = (e: Element) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]}`;
    const off = all.filter((e) => { const r = e.getBoundingClientRect(); return (r.right > W + 1 || r.left < -1) && !inScroller(e) && !e.closest("img,picture,svg"); }).map(name);
    const covered = all.filter((e) => e.children.length === 0 && (e as HTMLElement).innerText?.trim().length > 2).filter((e) => {
      const r = e.getBoundingClientRect();
      if (r.top < 0 || r.bottom > H || r.left < 0 || r.right > W) return false;
      if (clippedAt(e, r.left + r.width / 2, r.top + r.height / 2)) return false;
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top && top !== e && !e.contains(top) && !top.contains(e) && !top.closest("label,button,a,.demo-banner") && !e.closest(".demo-banner");
    }).map((e) => { const r = e.getBoundingClientRect(); return `"${(e as HTMLElement).innerText.trim().slice(0, 30)}" under ${name(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)!)}`; });
    // Text needs a gutter: nothing to read may touch the edge of the screen.
    const edge = all.filter((e) => e.children.length === 0 && (e as HTMLElement).innerText?.trim().length > 2 && !inScroller(e)).filter((e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= H && (r.left < 8 || r.right > W - 8); }).map((e) => `"${(e as HTMLElement).innerText.trim().slice(0, 30)}"`);
    const bar = document.querySelector(".desk-bar");
    const scroll = document.querySelector(".desk-scroll");
    const first = scroll ? [...scroll.querySelectorAll("*")].filter((e) => shown(e) && [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())).map((e) => e.getBoundingClientRect().top).sort((a, b) => a - b)[0] : undefined;
    return { edge: [...new Set(edge)].slice(0, 5), sideways: document.documentElement.scrollWidth > W, off: [...new Set(off)].slice(0, 5), covered: [...new Set(covered)].slice(0, 5), gap: bar && first !== undefined ? Math.round(first - bar.getBoundingClientRect().bottom) : null };
  });
  expect(found.sideways, `${where}: the page scrolls sideways`).toBe(false);
  expect(found.off, `${where}: off the screen`).toEqual([]);
  expect(found.covered, `${where}: text with something over it`).toEqual([]);
  expect(found.edge, `${where}: text touching the edge of the screen`).toEqual([]);
  if (found.gap !== null) expect(found.gap, `${where}: content starts right under the bar`).toBeLessThanOrEqual(40);
}

const back = (page: Page) => page.locator(".desk-bar .back-link").click();
const open = (page: Page, desk: string) => page.locator(".spot-bar").getByRole("button", { name: desk, exact: true }).click();
// From the room: wait until any desk has finished closing (a desk's bar carries the same menu while it is open).
const settings = async (page: Page) => { await expect(page.locator(".desk-overlay")).toHaveCount(0); await page.getByRole("button", { name: "Your account" }).click(); await page.getByRole("menuitem", { name: "Settings" }).click(); };

test.describe.configure({ mode: "serial" });
evidence(test);
test.beforeEach(() => forgetSignInRequests());

for (const width of [390, 360]) {
  test.describe(`on a phone ${width} wide`, () => {
    test.use({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });

    test("the CEO's office: one bar, the desks from the bottom bar, every desk fitting the screen", async ({ page }) => {
      await signIn(page, CEO);
      await expect(page.locator(".spot-bar")).toBeVisible();
      await expectFitsThePhone(page, "the office");
      if (width === 390) await shot(page, "On a phone: one bar, and the room's desks along the bottom");
      for (const desk of ["Computer", "Phone", "Contracts", "Directive", "Brief"]) {
        await open(page, desk);
        await expect(page.locator(".desk-bar")).toBeVisible();
        await expectFitsThePhone(page, `the ${desk} desk`);
        await back(page);
      }
      await settings(page);
      await expectFitsThePhone(page, "Settings");
      if (width === 390) await shot(page, "Settings on a phone: its sections are a row of tabs");
      await back(page);

      // The switch: hotspots on the picture instead of the bar, and back. The choice is kept.
      await page.getByRole("button", { name: "Hotspots", exact: true }).click();
      await expect(page.locator(".spot-bar")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Computer", exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("button", { name: "Hotspots", exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "Bar", exact: true }).click();
      await expect(page.locator(".spot-bar")).toBeVisible();
    });

    test("a client's room: every desk fitting the screen, and Settings from the account menu", async ({ page }) => {
      await signIn(page, OWNER);
      await page.goto("/client");
      await expect(page.locator(".spot-bar")).toBeVisible();
      await expectFitsThePhone(page, "the client room");
      for (const desk of ["Table", "Screen", "Board", "Shelf", "Lamp"]) {
        await open(page, desk);
        await expect(page.locator(".desk-bar")).toBeVisible();
        await expectFitsThePhone(page, `the ${desk}`);
        if (width === 390 && desk === "Shelf") await shot(page, "The client's library on a phone: nothing drawn over the title");
        await back(page);
      }
      await settings(page);
      await expect(page.getByRole("tab", { name: "Notifications", exact: true })).toBeVisible();
      await expectFitsThePhone(page, "a client's Settings");
    });
  });
}
