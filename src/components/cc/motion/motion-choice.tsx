"use client";

import { Button } from "@/components/ui/button";
import { setMotionPref, useMotionPref } from "@/lib/motion";
import { SlideGroup } from "./slide-group";

/**
 * The one switch for movement on screen. "Follow my device" moves unless the device asks for less motion; "Motion off" keeps every
 * change and drops the travel. Held in this browser (lib/motion), so it is each person's, on each device they use.
 */
export function MotionChoice() {
  const pref = useMotionPref();
  return (
    <SlideGroup active={pref} variant="pill" className="motion-choice" role="group" aria-label="Motion">
      <Button variant="ghost" aria-pressed={pref === "system"} onClick={() => setMotionPref("system")}>Follow my device</Button>
      <Button variant="ghost" aria-pressed={pref === "off"} onClick={() => setMotionPref("off")}>Motion off</Button>
    </SlideGroup>
  );
}
