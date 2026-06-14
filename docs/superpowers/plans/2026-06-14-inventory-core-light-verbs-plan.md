# Inventory Core And Light Verbs Implementation Plan

Date: 2026-06-14
Depends on: `docs/superpowers/specs/2026-06-14-inventory-core-light-verbs-design.md`

## Goal

Implement a first real inventory loop with classic light verbs (`Walk`, `Look`, `Use`, `Talk`), scene pickups, item selection, verb-aware hotspot routing, player HUD updates, and editor authoring for the new content model.

## Task 1: Extend contracts for items, pickups, and verb-aware hotspots

### Steps

1. Add a shared `Verb` schema and exported type in `packages/contracts`.
2. Add project-level item definitions to the content model.
3. Add layered-2D scene pickup instances.
4. Replace legacy single-action hotspot flow fields with verb-aware action fields and item-specific use mappings.
5. Update validation tests to cover the new schema shapes.

### Verification

- `pnpm test -- --run packages/contracts/src/validate.test.ts`
- `pnpm validate:sample`

## Task 2: Extend core state, commands, and replayable events

### Steps

1. Add `activeVerb`, `selectedItemId`, and `collectedPickups` to world state.
2. Add deterministic commands and events for:
   - verb selection
   - item selection and clearing
   - pickup collection
   - verb-aware hotspot use
3. Keep replay and event application behavior aligned with the current command pipeline.
4. Add focused tests for state transitions and duplicate-safe inventory insertion.

### Verification

- `pnpm test -- --run packages/core`
- `pnpm typecheck`

## Task 3: Add runtime interaction resolution for verbs, pickups, and item use

### Steps

1. Add a small runtime interaction resolver that dispatches behavior based on active verb and target type.
2. Support:
   - `Walk` on walk surface
   - `Look` on hotspot
   - `Talk` on hotspot
   - `Use` on pickup
   - `Use` on hotspot with and without selected item
3. Resolve item-specific hotspot use mappings before default `useFlowId`.
4. Keep unsupported interactions safe and user-visible through simple feedback.
5. Add runtime tests for verb routing and pickup collection behavior.

### Verification

- `pnpm test -- --run packages/runtime`
- `pnpm typecheck`

## Task 4: Update sample content to exercise the new gameplay loop

### Steps

1. Add at least one item definition to the sample project.
2. Add at least one pickup instance to the sample scene.
3. Update sample hotspot authoring to use verb-specific flow fields.
4. Add or adapt sample flows so the loop covers:
   - looking at a target
   - collecting an item
   - using an item on a hotspot

### Verification

- `pnpm validate:sample`
- `pnpm test`

## Task 5: Add player HUD for verbs and inventory

### Steps

1. Add a visible verb bar to the web player with active verb highlighting.
2. Add an inventory strip showing collected items by label.
3. Make inventory items selectable and deselectable.
4. Surface active verb, selected item, and unsupported interaction feedback in the player UI.
5. Keep scene rendering and dialogue continuation behavior intact.

### Verification

- `pnpm typecheck`
- `pnpm --filter @pointclick/player-web build`

## Task 6: Add editor authoring for items, pickups, and hotspot verb actions

### Steps

1. Extend editor project snapshots and draft helpers for project-level items.
2. Add inspector-first item authoring for:
   - `id`
   - `name`
   - `labelKey`
3. Add scene pickup authoring for:
   - `id`
   - `itemId`
   - `labelKey`
   - `bounds`
   - optional `pickupFlowId`
4. Extend hotspot inspector authoring for:
   - `lookFlowId`
   - `talkFlowId`
   - `useFlowId`
   - item-specific use mappings
5. Ensure undo/redo and autosave recovery cover the new draft surfaces.

### Verification

- `pnpm test`
- `pnpm typecheck`

## Task 7: Add validated persistence for new editor content

### Steps

1. Extend `packages/project-io` commands and patches for items, pickups, and verb-aware hotspot actions.
2. Keep all writes validated before persisting to disk.
3. Add `project-io` tests that prove item, pickup, and hotspot verb edits persist correctly.

### Verification

- `pnpm test -- --run packages/project-io`

## Task 8: Full integration verification

### Steps

1. Run the full test suite and typecheck pass.
2. Validate the sample project.
3. Build the player and package the editor.
4. Review the diff for consistency across contracts, core, runtime, sample content, player UI, and editor authoring.

### Verification

- `pnpm test`
- `pnpm typecheck`
- `pnpm validate:sample`
- `pnpm --filter @pointclick/player-web build`
- `pnpm --filter @pointclick/editor build`

## Notes

- Keep inventory unique by `itemId` for this milestone.
- Do not add item-to-item combinations yet.
- Prefer explicit runtime state for collected pickups rather than hiding this behavior inside flags.
- Normalize hotspot interactions into the new verb-aware shape instead of carrying two competing systems longer than necessary.
