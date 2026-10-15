"use client";

import Image from "next/image";
import { useLighting, type Lighting } from "@/lib/lighting";
import type { LitArt } from "./room-art";

/**
 * A place in both lights, stacked. Night is always underneath; the day photograph sits on top at opacity 0 and the
 * stylesheet fades it in when <html data-lighting="day"> (see .lit-day in motion.css), so changing the time of day is one
 * crossfade, never a swap. Both carry a blurred placeholder (built from the static import) so a photograph that is still being
 * optimised shows its own colours instead of a black frame. The parent must be positioned: both images fill it and take the className's object-fit / filter.
 * `lighting` overrides the building's setting for a place that keeps its own time (the lobby follows the visitor's clock); the
 * crossfade is then driven by the parent's `data-lit` instead of <html data-lighting>.
 */
export function LitImage({ art, alt = "", sizes, quality = 70, className, draggable = false, lighting: own }: { art: LitArt; alt?: string; sizes: string; quality?: number; className?: string | undefined; draggable?: boolean; lighting?: Lighting | undefined }) {
  const building = useLighting();
  const lighting = own ?? building;
  return (
    <>
      <Image src={art.night} alt={alt} fill sizes={sizes} quality={quality} loading="eager" placeholder="blur" className={className} draggable={draggable} />
      <Image src={art.day} alt="" aria-hidden="true" fill sizes={sizes} quality={quality} loading={lighting === "day" ? "eager" : "lazy"} placeholder="blur" className={`${own ? "lit-day-own" : "lit-day"}${className ? ` ${className}` : ""}`} draggable={draggable} />
    </>
  );
}
