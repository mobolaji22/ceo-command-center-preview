/**
 * The Command Center's one kit (v4 ADR-0099 Decision 13): pieces every surface builds from, taken from what already worked rather
 * than written again. The panel that opens over a scene is the desks' overlay; numbers roll and actions confirm through the motion
 * kit merged as Command Center #42 (one spring, transform and opacity only).
 */
export { DockCard } from "./dock-card";
export { Pin, pinWords } from "./pin";
export { DeskOverlay as Panel } from "@/components/cc/desk-overlay";
export { RollingNumber } from "@/components/cc/motion";
