# Inventory Core And Light Verbs Design

Date: 2026-06-14
Status: Proposed

## Goal

Add a first real inventory system to the engine, together with a light classic-adventure verb interface based on `Walk`, `Look`, `Use`, and `Talk`.

This milestone should make point-and-click interactions meaningfully authorable without yet expanding into full item combinations, dialogue choices, or advanced adventure scripting.

## Scope

Included:

- global item definitions in project content
- scene pickup instances that add items to the player inventory
- active verb state for `Walk`, `Look`, `Use`, and `Talk`
- selected inventory item state for `Use`
- hotspot interactions routed by active verb
- `Use` routing with optional item-specific overrides
- player HUD for verb selection and inventory selection
- editor authoring for verb-aware hotspots and scene pickups

Excluded:

- item-to-item combinations
- drag-and-drop inventory UX
- inventory stack counts
- equipment slots
- dialogue choices
- flow conditions and flow calls
- puzzle dependency graph tooling

## Why This Shape

The engine already has walking, hotspot activation, flags, and narrative flows. The next sensible layer is to give authors a way to express classic adventure interactions with just enough structure to feel real.

This design keeps the system legible:

- verbs stay few and explicit
- inventory items are globally defined once
- world pickups are scene-local instances
- authoring stays close to flows instead of inventing a second scripting language

## Options Considered

### Option A: Light classic verbs plus inventory

Use a small verb bar with explicit `Walk`, `Look`, `Use`, and `Talk`, and route hotspot behavior through verb-specific flow references.

This is the chosen option because it gives the right adventure-game feel while staying tractable for the current runtime and editor.

### Option B: Contextual interaction only

Skip visible verbs and auto-pick interactions based on the target.

Rejected because it would undershoot the intended genre and make author intent fuzzier.

### Option C: Full SCUMM-style verb surface

Add a wider verb matrix and more combinatorial interaction rules immediately.

Rejected for now because it would expand authoring, runtime behavior, and UI complexity too quickly.

## Architecture

### Content model

Add item definitions at the project level:

- `ItemDocument`
  - `id`
  - `name`
  - `labelKey`
  - optional presentation metadata for later UI use

Add pickup instances in layered-2D scenes:

- `ScenePickup`
  - `id`
  - `itemId`
  - `labelKey`
  - `bounds`
  - optional `pickupFlowId`

Extend hotspot authoring with verb-aware interactions:

- `lookFlowId`
- `talkFlowId`
- `useFlowId`
- `useItemFlows: Array<{ itemId, flowId }>`

For this milestone, existing hotspot activation can be normalized into the new shape rather than maintained as a competing path.

### Runtime state

Extend world state with:

- `activeVerb`
- `selectedItemId`
- existing `inventory`
- collected pickup tracking

Collected pickup tracking should be explicit and deterministic, not inferred indirectly from flags.

Suggested:

- `collectedPickups: string[]`

### Command and event model

Add explicit commands and events for:

- selecting a verb
- selecting or clearing an inventory item
- collecting a pickup
- using an item on a hotspot

Keep the event model deterministic and replayable like the current command pipeline.

### Interaction resolver

The runtime should introduce a focused interaction resolution layer that:

1. reads active verb
2. reads selected item state
3. identifies target type (`walk area`, `pickup`, `hotspot`)
4. resolves the matching flow or pickup action
5. emits commands and events

This avoids burying branching interaction logic directly inside the renderer or player UI.

## Data Model

Suggested enums and shapes:

- `Verb = "walk" | "look" | "use" | "talk"`

- `ItemDefinition`
  - `id`
  - `name`
  - `labelKey`

- `PickupInstance`
  - `id`
  - `itemId`
  - `labelKey`
  - `bounds`
  - `pickupFlowId?`

- `HotspotVerbActions`
  - `lookFlowId?`
  - `talkFlowId?`
  - `useFlowId?`
  - `useItemFlows`

Suggested world additions:

- `activeVerb: Verb`
- `selectedItemId: string | null`
- `inventory: string[]`
- `collectedPickups: string[]`

## Interaction Behavior

### Walk

- clicking the walk surface moves the player as today
- clicking a hotspot or pickup with `Walk` active should prefer movement-oriented handling only if explicitly needed later
- for this milestone, `Walk` on non-walk targets can no-op or show simple feedback

### Look

- clicking a hotspot resolves `lookFlowId`
- clicking a pickup resolves either its `pickupFlowId` only when the intended authoring says pickup also describes itself, or a simple fallback flow if configured
- if no handler exists, the runtime returns a graceful no-op or fallback feedback

### Talk

- clicking a hotspot resolves `talkFlowId`
- pickups generally do not need `Talk` behavior for this milestone unless explicitly authored later

### Use without selected item

- clicking a hotspot resolves its base `useFlowId`
- clicking a pickup should collect it

### Use with selected item

Resolution order:

1. check hotspot item-specific mapping `itemId -> flowId`
2. fall back to hotspot base `useFlowId`
3. if neither exists, emit a safe no-op or fallback feedback

Selected item remains selected until the player changes it or clears it.

## Pickup Behavior

- pickups are visible scene targets until collected
- collecting a pickup appends the corresponding `itemId` to inventory if not already present
- the pickup instance is marked collected in runtime state
- collected pickups should stop rendering and stop hit-testing
- optional `pickupFlowId` can run alongside collection for flavor text

For this milestone, duplicate inventory entries for the same item should be rejected. Inventory is a unique set represented as an ordered array.

## Player UI Design

### Verb bar

Add a visible verb bar with:

- `Walk`
- `Look`
- `Use`
- `Talk`

The active verb should be clearly highlighted.

### Inventory strip

Add a visible inventory strip:

- shows collected items by label
- clicking an item selects or deselects it
- selected item is highlighted

Recommended behavior:

- selecting an item does not force `Use`, but `Use` plus selected item is the main item-interaction path

### Feedback

Provide lightweight status feedback for:

- active verb
- selected item
- unsupported interaction

This can remain simple text in the existing player footer or status region.

## Editor Design

### Project authoring

Add an item workspace or item section for project-level item definitions.

For this milestone, inspector-first authoring is enough:

- list items
- edit `id`
- edit `name`
- edit `labelKey`

### Scene authoring

Add pickup authoring to layered-2D scenes:

- list pickups in the scene tree or inspector
- edit bounds
- edit `itemId`
- edit `labelKey`
- edit optional `pickupFlowId`

### Hotspot authoring

Extend hotspot inspector fields to author:

- `lookFlowId`
- `talkFlowId`
- `useFlowId`
- item-specific use mappings

This should stay draft-based and continue using validated command persistence.

## Error Handling

- selecting unknown item ids should no-op safely
- collecting a pickup with a missing item definition should fail validation rather than corrupt runtime state
- hotspots referencing missing flows should fail content validation where possible
- unsupported interactions should not crash the player
- duplicate inventory insertion should be ignored safely

## Testing

Add coverage for:

- schema validation of item definitions, pickups, and hotspot verb fields
- core command/event transitions for:
  - verb selection
  - item selection
  - pickup collection
  - use with and without selected item
- runtime interaction resolution for:
  - `Look`
  - `Talk`
  - `Use`
  - pickup collection
- sample project validation with at least one item and one pickup path
- editor draft behavior where new authoring surfaces are added

Verification pass:

- `pnpm test`
- `pnpm typecheck`
- `pnpm validate:sample`
- `pnpm --filter @pointclick/editor build`

## Implementation Notes

Suggested order:

1. extend contracts for items, pickups, verbs, and hotspot verb actions
2. update core commands, events, and world state
3. add runtime interaction resolver
4. update sample content with at least one pickup and one item-aware hotspot
5. add player HUD for verbs and inventory
6. add editor authoring for items, pickups, and hotspot verb actions
7. run full verification and package build

## Risks And Limits

- mixing legacy hotspot activation with verb-aware routing can create ambiguity if not normalized cleanly
- editor authoring surface may grow quickly if items, pickups, and hotspot mappings all land in one inspector at once
- fallback behavior for unsupported interactions should stay clear, or the system will feel inconsistent

These are acceptable risks for this milestone because they buy us a real gameplay loop instead of just a decorative inventory bar.

## Done Criteria

This step is complete when:

- the engine supports visible verbs and inventory selection
- scene pickups can be collected into inventory
- hotspot interactions resolve by verb and selected item where authored
- player UI exposes verb and inventory state
- editor authoring covers the new content model
- automated validation passes
