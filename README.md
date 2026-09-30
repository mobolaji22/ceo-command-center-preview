# CEO Command Center Preview

Recreate the CEO Command Center UI so I can preview and interact with it:

1. Coherent Glassmorphism & Contrast System
- Dark glassmorphism system: rgba(20, 20, 24, 0.82) with backdrop-filter: blur(16px), crisp 1px solid rgba(255, 255, 255, 0.08) border, and subtle amber/gold accent glow (#f59e0b / #fbbf24) matching executive desk lighting.
- Localized gradient underlays behind headers and primary copy (linear-gradient(180deg, rgba(15,15,18,0.95) 0%, rgba(20,20,24,0.85) 100%)) so typography remains legible against scene backgrounds.

2. Minimal Device Frames & Panels
- Phone Container: Ultra-thin matte bezel (border radius 28px, minimal top speaker slit and camera notch dot). Content: AGENCY PULSE CHANNEL status pill, Executive Attention, Daily Executive Brief card, Decisions Requiring CEO Signature with risk-reversibility badges (Low / reversible, Medium / managed), Exceptions Detected, and Nervous System Activity.
- Computer Container: Slim window bar with three 8px traffic-light dots and synchronized state indicator: `> DevPlaybook V4 Core Canonical Operating System // State: Synchronized DPL-01`. Tabs: Cases & Engagements, Decision Ledger, Security/Gov occupying minimal vertical height, leaving 85%+ of viewport height for active dossiers and status feeds.
- Contract / Dossier: Header: DEVPLAYBOOK GOVERNANCE PROTOCOL · AUTHORIZATION CONTRACT with shield icon. Tabs: Contract Review, Modify Constraints & Scope, Request Evidence. Classification banner (CEO approval required), Proposed Action in bold editorial serif, Organizational Reasoning, and Substantiating Evidence Trail trigger. Interactive approval/reject resolution actions.

3. Two-Step Hotspot Interaction & Scene
- Interactive CEO Office scene: Circular pulsing markers on key objects (mug, desk dossier, phone, door, monitor) and bottom indicator: Hotspots active: Computer · Phone · Contracts · Directive · Brief · Door.
- First-Click Glass Card: Clicking any hotspot pops an anchored preview card (e.g. ☕ EXECUTIVE FOCUS for atmosphere toggle, or ✨ THE CEO BRIEF with quote "What happened while I was away?" and "Review Full Brief →"). Clicking action navigates directly to the full device view.

4. Hallway Corridor Doors
- Vertical door cards styled with door proportions, room numbers (01, 02, 03...), architectural icons, and live department status pills.
- Entire door card is clickable to enter the room. Doors without fitted rooms show a "Being fitted out" badge.

5. Executive Directive Composer
- Header: 🧠 Executive Directive · Intent Framing with close button.
- Philosophy banner: "The CEO does not manage tasks. The CEO sets direction, resolves ambiguity, and authorizes consequential action."
- Clean textarea for natural language directive input with prompt suggestions.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/220826ec-f433-45b1-abd3-6cb54073157e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
