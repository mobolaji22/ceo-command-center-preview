"use client";

import { useState } from "react";

/**
 * Counts the times a figure went up, so something can mark the arrival (a badge gives one small bump when there is one more
 * thing to see, and none when there is one fewer). The answer is a key: give it to the element, and it bumps once per rise.
 */
export function useRaised(value: number): number {
  const [seen, setSeen] = useState(value);
  const [rises, setRises] = useState(0);
  // Adjusted during render, not in an effect: the new key is on the element in the same paint as the new figure.
  if (value !== seen) { setSeen(value); if (value > seen) setRises(rises + 1); }
  return rises;
}
