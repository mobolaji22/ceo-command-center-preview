"use client";

import { useEffect } from "react";
import { useAgencyBrand } from "@/lib/brand";
import { brandFontsHref, brandThemeVars } from "@/lib/brand-vars";

/**
 * The agency's look as CSS custom properties (v4 ADR-0093 Decision 4, ADR-0099 Decision 11). The brand record names its colours and
 * type styles by the approved direction's own tokens; each becomes `--brand-<token>` (and `--brand-type-<token>-family`, `-size`,
 * `-weight`, `-tracking`, `-leading`) on <html>, so every surface and portal can read it. Until a direction is approved the record
 * holds no look and nothing is set: the house look stands, and no screen invents a brand colour. The look's typefaces are loaded from
 * the font service by name. The studio home (src/app/studio-home.css) is the first surface dressed in the brand; the rest follow in
 * slice 4.7.
 */

/** Sets the brand's variables on <html> while mounted, and marks whether the look is the brand's or the house's. */
export function BrandTheme() {
  const { brand } = useAgencyBrand();
  const look = brand?.look ?? null;
  useEffect(() => {
    const root = document.documentElement;
    const vars = brandThemeVars(look);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.dataset["look"] = Object.keys(vars).length ? "brand" : "house";
    // The look's typefaces are data too, so they load from the record's names rather than shipping with the app.
    const href = brandFontsHref(look);
    const link = href ? Object.assign(document.createElement("link"), { rel: "stylesheet", href }) : null;
    if (link) document.head.appendChild(link);
    return () => {
      link?.remove();
      for (const k of Object.keys(vars)) root.style.removeProperty(k);
      delete root.dataset["look"];
    };
  }, [look]);
  return null;
}
