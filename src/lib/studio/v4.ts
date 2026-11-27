import type { FloorView, InitiativeSetting, RoomView, StudioView } from "./studio.generated";

/**
 * v4's studio (dev-playbook-v4 ADR-0099): the office's pins and docked cards, the Floor of every engagement, and one room's Glance,
 * Steer and Workbench. The shapes are v4's, generated from the schema it publishes (`npm run v4:types`); this file only names their
 * parts. Every count, state and reason in them is v4's; the Command Center draws them and decides nothing (INV-27).
 */
export type { FloorView, InitiativeSetting, RoomView, StudioView };
export type RoomCode = RoomView["room"];
export type StationView = StudioView["stations"][number];
export type DecideItem = StudioView["decide"]["items"][number];
export type DecideKind = DecideItem["kind"];
export type FloorGroup = FloorView["groups"][number];
export type EngagementRow = FloorGroup["engagements"][number];
export type LoopStage = NonNullable<EngagementRow["stage"]>;
export type EngagementState = EngagementRow["state"];
export type RoomWorkState = EngagementRow["rooms"][number]["state"];
export type HeldItem = RoomView["glance"]["held"][number];
export type WaitReasonCode = NonNullable<HeldItem["reason"]>;
export type RoomMoveView = RoomView["moves"][number];
export type RoomMove = RoomMoveView["move"];
export type RoomInitiativeView = RoomView["initiative"];
export type InitiativeCadence = InitiativeSetting["cadence"];
export type WorkbenchKind = RoomView["workbench"];
