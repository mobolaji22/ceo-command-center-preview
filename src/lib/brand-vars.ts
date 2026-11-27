import type { AgencyLook } from "@/lib/model";

/**
 * The brand's look as CSS custom properties, worked out without React so it can be checked on its own (src/lib/brand-theme.tsx
 * sets them). The record is v4's and the CEO's, but a value still reaches a style attribute, so only plain colour and size values pass.
 */

/** A token name as CSS can carry it: `surface`, `ink-soft`, `Signing violet` → `signing-violet`. Empty when nothing is left. */
export const tokenSlug = (name: string): string =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/** Hex, or an rgb/hsl/oklch function of numbers, percentages and separators only: never a url(), var() or expression. */
const COLOUR = /^(?:#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8}|(?:rgb|rgba|hsl|hsla|oklch|oklab)\(\s*[0-9.%\s,/+-]+(?:deg)?\s*\))$/i;
/** A typeface's name: letters, digits, spaces, hyphens and dots, as type foundries name them. */
const FAMILY = /^[\p{L}\p{N} .-]{1,60}$/u;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function brandThemeVars(look: AgencyLook | null | undefined): Record<string, string> {
  if (!look) return {};
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(look.colours)) {
    const slug = tokenSlug(name);
    if (slug && typeof value === "string" && COLOUR.test(value.trim())) vars[`--brand-${slug}`] = value.trim();
  }
  for (const [name, style] of Object.entries(look.type)) {
    const slug = tokenSlug(name);
    if (!slug) continue;
    const family = (style.typeface ?? style.family).trim();
    if (FAMILY.test(family)) vars[`--brand-type-${slug}-family`] = `"${family}"`;
    if (finite(style.size) && style.size > 0 && style.size < 400) vars[`--brand-type-${slug}-size`] = `${style.size}px`;
    if (finite(style.weight) && style.weight >= 100 && style.weight <= 1000) vars[`--brand-type-${slug}-weight`] = String(style.weight);
    if (finite(style.tracking) && Math.abs(style.tracking) < 1) vars[`--brand-type-${slug}-tracking`] = `${style.tracking}em`;
    if (finite(style.lineHeight) && style.lineHeight > 0 && style.lineHeight < 4) vars[`--brand-type-${slug}-leading`] = String(style.lineHeight);
  }
  return vars;
}
