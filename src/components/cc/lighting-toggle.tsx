"use client";

import { Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setLighting, useLighting } from "@/lib/lighting";

/** Day / night for the whole building. A fixed label with a pressed state, so assistive tech hears "Day lighting, on" or "off". */
export function LightingToggle() {
  const day = useLighting() === "day";
  return (
    <Button variant="ghost" size="icon" className="icon-button lighting-toggle" aria-label="Day lighting" aria-pressed={day} title={day ? "Day lighting: on" : "Day lighting: off"} onClick={() => setLighting(day ? "night" : "day")}>
      <Sun size={16} />
    </Button>
  );
}
