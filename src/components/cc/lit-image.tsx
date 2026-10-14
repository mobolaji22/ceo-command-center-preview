"use client";

import Image from "next/image";
import { useLighting } from "@/lib/lighting";
import type { LitArt } from "./room-art";

/**
 * A place in both lights, stacked. Night is always underneath; the day photograph sits on top at opacity 0 and the
 * stylesheet fades it in when <html data-lighting="day"> (see .lit-day in motion.css), so changing the time of day is one
 * crossfade, never a swap. Both carry a blurred placeholder (built from the static import) so a photograph that is still being
 * optimised shows its own colours instead of a black frame. The parent must be positioned: both images fill it and take the className's object-fit / filter.
 */
export function LitImage({ art, alt = "", sizes, quality = 70, className, draggable = false }: { art: LitArt; alt?: string; sizes: string; quality?: number; className?: string | undefined; draggable?: boolean }) {
  const lighting = useLighting();
  return (
    <>
      <Image src={art.night} alt={alt} fill sizes={sizes} quality={quality} loading="eager" placeholder="blur" className={className} draggable={draggable} />
      <Image src={art.day} alt="" aria-hidden="true" fill sizes={sizes} quality={quality} loading={lighting === "day" ? "eager" : "lazy"} placeholder="blur" className={`lit-day${className ? ` ${className}` : ""}`} draggable={draggable} />
    </>
  );
}
