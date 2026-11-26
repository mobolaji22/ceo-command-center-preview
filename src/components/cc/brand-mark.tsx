"use client";

import { useState } from "react";
import { useAgencyBrand } from "@/lib/brand";

/**
 * The agency's mark (v4 ADR-0095) where a screen signs itself: the SVG the CEO chose, drawn as an image so nothing in it can run
 * here. Every place it stands also prints the agency's name beside it, so the image is decorative to a screen reader. Until one is chosen, or if it fails to load, the plain square holds the place; it is the Command Center's own, not the
 * brand's, and the redesign (Plan §13.0 step 4) replaces it.
 */
export function BrandMark({ size = 24 }: { size?: number }) {
  const { markUrl } = useAgencyBrand();
  const [failed, setFailed] = useState<string | null>(null);
  if (markUrl && failed !== markUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- an SVG from the API: next/image adds nothing and would need its host configured
    return <img className="brand-mark-image" src={markUrl} alt="" width={size} height={size} onError={() => setFailed(markUrl)} />;
  }
  return <span className="brand-mark" aria-hidden="true"><span /></span>;
}
