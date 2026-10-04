# The living agency: visual and interaction plan

## Direction

Build **Cinematic Executive Command** as a coherent working place, not a decorative dashboard. The selected **warm architectural** palette (#17191A charcoal, #33403B deep green, #C89A4B brass, #E9DDD0 warm light), **DM Serif Display + Fira Sans**, and **full-width spatial journey** apply across the experience. Keep the existing office's recognizable objects, restrained glass, functional labels, and real v4 status. Use the supplied screenshot as a reference for the computer hotspot's immediate contextual reveal, not as an image to embed or as permission to copy its unrelated pipeline.

## Experience map

1. **CEO office — the entry hall.** Retain the photographic office and map hotspots accurately to door/corridor, computer, phone, contracts, directive, brief, and focus. A pointer hover reveals a compact preview anchored beside the object; a single click opens it. Keyboard focus reveals the same preview, Enter/Space opens it, and Escape dismisses it. Touch uses clearly labeled, sufficiently large targets and one tap to open; offer an always-available destination list so discovery never depends on hover or image cropping. Keep counts and state sourced from the live ledger, not painted into the photo. Move or flip previews when they would cover other controls or leave the viewport; eliminate the preview's extra action click.
2. **Corridor — orientation.** Generate a dedicated architectural corridor image that connects visually to the existing office. Give the nine established departments legible wayfinding and direct access; preserve the existing domain-to-project mapping rather than inventing new departments. Quiet rooms still exist but look intentionally unoccupied. A compact list provides the same access on small screens and for nonvisual navigation.
3. **Department rooms — evidence of work.** Produce a cohesive room-image family with recognizable variations for Business, Market, Brand, Content, Design, Marketing, Engineering, Strategy, and Social Growth. Maintain a stable room identity across visits. Place live projects and the existing pinboard/calendar above a readable surface; empty rooms remain empty. Room names and status live in accessible HTML, never generated image lettering.
4. **Working desks.** Bring the computer/cases and ledger, contracts/governance, phone/attention, directive/intents, brief/archive, and records/people/library into the same architectural language. Each gets a purposeful environmental cue (desk surface, document table, communication nook, writing desk, reading table, filing wall) without putting dense forms, signatures, source evidence, or critical decisions on top of a busy photograph. Preserve their current workflows, permissions, and API-backed data.
5. **Client room.** Refresh `/client` as a welcoming but distinct client-facing room connected to the agency: project shelves, current requests, decisions, questions, briefs, deliverables, timeline, and library should be scannable in that order of urgency. The image supports orientation; controls and evidence remain clearly readable. Preserve client/owner permissions and never imply that a non-owner can approve.
6. **Entry and focused pages.** Extend the visual system to sign-in/invitation, standalone brief and action pages, loading/empty/error states. These get quiet contextual imagery or material detail rather than a full immersive scene where a short task demands focus.

## Image production

- Make a visual inventory and shot list before rendering: existing CEO office is the continuity anchor; create a corridor, nine coordinated department-room plates, a client-room plate, and a small set of reusable work-surface/editorial crops for the working desks and focused pages. Refine the existing office image by editing its source only if new hotspot placement or continuity requires it; do not regenerate an unrelated office.
- Direct every image as the same plausible building: consistent walnut/brass/green materials, time-of-day and light direction, restrained photographic realism, open space for UI, visible objects that identify the room. Avoid baked-in words, fictional brands, people, fake status displays, and visually dense center areas.
- Generate and inspect images in coherent batches, reject inconsistent lighting or perspective, optimize for desktop and mobile crops, and store app imagery as app assets. Use real HTML for all wayfinding and live information, with meaningful alternative text where imagery is informative.

## Interaction and quality bar

- One clear action per hotspot; predictable Back to Office / Back to Corridor paths; preserve current work when moving between sections where feasible. Add subtle door/desk transitions and hotspot feedback, with reduced-motion equivalents. Never let animation delay a decision or obscure errors.
- Keep operational content more prominent than the room image once inside a work area. Use semantic design tokens, strong foreground contrast on glass, visible focus, 44px-class touch targets, stable layouts, no text overlap, and no hover-only information.
- Review the full experience at desktop, tablet, and mobile sizes, including short-height screens: every hotspot, preview, corridor door, room, client action, empty state, sign-in, brief, and action link. Test pointer, keyboard, touch, and reduced motion; verify real v4-backed interactions still complete and read back. The current local preview capture rendered almost entirely black despite returning HTTP 200, so first diagnose the preview/runtime rendering and use authenticated or permitted fixture views appropriately before judging the visual result.

## Connected motion, not screen-by-screen effects

- Establish a **spatial grammar**: entering a doorway advances into the corridor; opening a room carries its name and threshold into the next view; opening a desk moves attention from the object to its working surface; Back reverses that relationship. Retain a small persistent location marker so a user always knows where they are. Transitions preserve directional meaning across desktop and mobile rather than using unrelated fades.
- Choreograph in three layers: immediate hotspot feedback (roughly 100–150 ms), a short shared threshold/section transition (roughly 220–320 ms), and content reveal only after the destination is legible. Keep controls responsive throughout; never animate a live number as if its value changed. Subtle ambient light and material shifts may suggest a living agency, but no perpetual movement around reading or decision areas.
- The selected **Cinematic Executive Command** reference governs compositional emphasis: architectural image as a wide, immersive backdrop; a restrained brass wayfinding line; preview adjacent to its object; and a strong, intentional action at the desk. Do not copy the example's sign-in or fictional six-step pipeline into the CEO office. Respect reduced motion by replacing travel and parallax with immediate state changes and clear focus placement.
- Define motion continuity for forward/back, hover/focus/press, tabs and filters, opening a case file, flipping the room history, loading new information, and completing a decision. Success confirmations remain visible long enough to read; errors are never hidden by a transition. Preserve scroll or restore the destination's logical heading rather than dropping the user in an arbitrary position.

## Information architecture: each room earns its metaphor

Use a consistent reading order on every working screen: **where am I → what changed → what needs me → supporting context/evidence → next action**. The top band is a brief live summary, not a hero-sized decoration; a person can scan what is urgent without scrolling through scenery. Put statuses, ownership, dates, counts, and sources close to the item they qualify; use plain-language labels with restrained color as a secondary signal. Avoid nested cards and repeated decorative frames.

| Space | First-glance information | Deeper reading and primary action |
| --- | --- | --- |
| CEO office | Real pending signatures and current agency state beside clearly named destinations | Hover/focus preview gives one-sentence context; select enters immediately. |
| Corridor | Department name, active/quiet state, number of live projects | Enter a room; accessible list mirrors the spatial map. |
| Department room | Work in motion, waiting, done; pinned projects | Select a project; dated calendar reveals tasks in context without burying the board. |
| Computer | Active cases, decisions requiring attention, system health | Tabs keep dossiers, decision ledger, and governance distinct; each row exposes status, age, owner/context, and a clear route to evidence or action. |
| Contracts | Queue size and next authorization, decision owner, risk, reversibility | Proposal/reasoning/evidence appear before approve/reject; consequential actions get confirmation and a readable result. |
| Phone | Highest-priority attention and latest signal | Compact summaries lead into the full brief, contract, or question; do not compress substantive decisions into unreadably small phone chrome. |
| Directive | Target and intent at a glance | Prompts and input stay focused; validation, submit state, and the resulting request are easy to locate. |
| Brief | Changed since last visit, needs judgment, momentum | Timeline and source-backed briefs provide drill-down; empty states say what is genuinely absent. |
| Records & access | Projects, people, organizations, library with clear separation | Selection keeps its detail visible; invite and file actions have explicit permissions and outcomes. |
| Client room | Decisions/questions due, project standing, most recent update | Separate shelves for requests, project details, briefs, deliverables, library and timeline; show provenance, download state, and the next permitted action without exposing CEO-only controls. |

On narrow screens, replace the scenic spread with a readable stacked sequence: location and urgency first, one primary action, then collapsible or tabbed supporting material. On larger screens, keep one stable content column plus a contextual side rail where it genuinely helps comparison. Empty, loading, failure, permission-denied, long-title, and high-volume states receive deliberate layouts rather than generic blank cards.

## Acceptance gates for a world-class finish

- **Navigation:** A first-time user can find every destination without guessing which dot means what; every office hotspot opens in one activation and every detail has an obvious way back. No hover-only access.
- **Comprehension:** In a five-second glance at each screen, the urgent item, its project/owner, current state, and next possible action are identifiable; no image, animation, or glass effect obscures them.
- **Continuity:** Forward/back motion follows the same physical direction, no jarring scene reset, no overlapping preview or clipped label at common and short-height viewports; reduced-motion mode conveys the same location and result.
- **Trust:** Counts match the items opened; empty states never manufacture activity; approvals, client actions, requests, and uploads retain their current permission checks and show a persisted result after refresh.
- **Accessibility and performance:** Keyboard-only completion of all core tasks, visible focus and logical heading order, meaningful accessible names, readable contrast, responsive imagery that does not block interaction, and no layout shift from loading media. Verify this against actual rendered desktop/mobile screenshots and representative populated as well as empty data.

## Technical boundaries and rollout

- This is a presentation and navigation redesign. Keep the existing Next.js front end, `DataSource` boundary, server-held session, invitation-only access, and v4 API authority unchanged. No fabricated records, client-side session shortcuts, or new backend scope.
- Implement in passes: (1) restore a usable preview and establish visual tokens/typography; (2) office interaction and navigation; (3) corridor and department-room imagery; (4) working desks and client room; (5) focused pages, accessibility, and end-to-end visual review. Each pass must preserve the live workflows before proceeding.