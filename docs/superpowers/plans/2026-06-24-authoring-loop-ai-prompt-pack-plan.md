# Authoring Loop And AI Prompt Pack Implementation Plan

Date: 2026-06-24
Depends on: `docs/superpowers/specs/2026-06-24-authoring-loop-ai-prompt-pack-design.md`

## Goal

Implement the first authoring-first slice for scene actors, props, interaction
spots, and AI prompt packs.

This plan intentionally keeps provider integration mocked. The deliverable is a
usable editor workflow: lay out walk areas, hotspots, actors, props, interaction
spots, generate a structured prompt pack from scene context, review it, persist
it, and keep runtime preview aligned with the new scene model.

## Task 1: Extend contracts for actors, spots, conditions, and prompt packs

### Steps

1. Add `ConditionExpressionSchema` and exported `ConditionExpression` type.
2. Add `SceneActorRoleSchema`, `SceneActorSchema`, and exported `SceneActor`
   type.
3. Extend layered-2D scenes with `actors: SceneActor[]`.
4. Extend hotspots with optional `interactSpot` and `lookSpot`.
5. Add `PromptPackDocumentSchema` and related prompt pack types.
6. Extend the project manifest and `ProjectBundle` with prompt pack references.
7. Update contract validation tests for valid and invalid examples.

### Verification

- `pnpm test -- --run packages/contracts`
- `pnpm validate:sample`

## Task 2: Update sample project data safely

### Steps

1. Add empty `actors: []` to existing layered-2D sample scenes.
2. Add interaction spots to the tavern entrance and dock hook where useful.
3. Add one checked-in sample prompt pack document tied to `moonlit-dock`.
4. Add prompt pack references to `adventure.project.json`.
5. Keep current sample gameplay behavior unchanged.

### Verification

- `pnpm validate:sample`
- `pnpm test`

## Task 3: Extend project IO and validation diagnostics

### Steps

1. Load prompt pack documents from manifest references.
2. Include prompt packs in `ProjectBundle` and editor snapshots.
3. Validate prompt pack scene references.
4. Validate actor asset references when `assetId` is present.
5. Validate actor and hotspot interaction spots as scene points.
6. Warn when actor label keys are missing in the default locale.
7. Add persistence support for prompt pack creation or update.

### Verification

- `pnpm test -- --run packages/project-io`
- `pnpm validate:sample`

## Task 4: Add runtime target handling for actors and interaction spots

### Steps

1. Add actor lookup for the current layered-2D scene.
2. Add condition evaluation for actor visibility from `WorldState`.
3. Add actor interaction resolution using the existing verb and item routing.
4. Move the player to `interactSpot` before dispatching actor or hotspot
   interactions.
5. Keep movement endpoint-style for this milestone.
6. Preserve current hotspot and pickup behavior.
7. Add runtime tests for hotspot and actor interaction spots.
8. Add runtime tests for conditional actor visibility.

### Verification

- `pnpm test -- --run packages/runtime`
- `pnpm typecheck`

## Task 5: Extend renderer support for visible actors

### Steps

1. Render visible scene actors as asset-backed sprites when `assetId` resolves.
2. Render a simple debug shape for actors without assets.
3. Respect actor `bounds` and `depth`.
4. Register actor pointer targets and forward clicks to runtime handlers.
5. Hide actors whose conditions are false.
6. Preserve existing pickup and hotspot targets.

### Verification

- `pnpm --filter @pointclick/renderer-2d build`
- `pnpm --filter @pointclick/player-web build`
- `pnpm test`

## Task 6: Extend editor session state for actors and spots

### Steps

1. Add actor draft state with id, role, label key, asset id, bounds, depth,
   condition, actions, interact spot, and look spot.
2. Add draft keys for actor dirty-state tracking.
3. Add helper functions to create, update, delete, and apply actor drafts.
4. Add undo, redo, and autosave recovery support for actor edits.
5. Extend hotspot drafts with interact spot and look spot fields.
6. Add focused editor-session tests.

### Verification

- `pnpm test -- --run apps/editor/src/editor-session.test.ts`
- `pnpm --filter @pointclick/editor typecheck`

## Task 7: Build viewport Actors Mode

### Steps

1. Add `Actors` as a scene tool in editor capabilities.
2. Render actor labels, translucent bounds, and draggable handles in the scene
   viewport.
3. Support selecting actors from the viewport.
4. Support dragging and resizing actor bounds.
5. Support dragging `interactSpot`.
6. Support enabling, clearing, and dragging `lookSpot`.
7. Surface actor health badges for missing asset, missing locale, missing
   action, and invalid spot.
8. Keep inspector controls as a precise editing path.

### Verification

- `pnpm --filter @pointclick/editor typecheck`
- `pnpm --filter @pointclick/editor build`
- `pnpm test`

## Task 8: Tighten Walk Mode and Hotspots Mode around the same viewport model

### Steps

1. Keep existing walk area point dragging but align labels, hints, and footer
   copy with the new mode model.
2. Add clear visual distinction between walk area, hotspot bounds, actor bounds,
   interact spots, and look spots.
3. Add hotspot interact spot and look spot viewport handles.
4. Ensure selection does not accidentally move objects while using Select mode.
5. Add validation summaries that can jump to the broken viewport target.

### Verification

- `pnpm --filter @pointclick/editor build`
- `pnpm test`

## Task 9: Add AI prompt pack provider boundary and mock provider

### Steps

1. Add a prompt generation module with `GeneratePromptPackRequest`,
   `PromptPackCandidate`, `PromptProvider`, and `PromptProviderJob` types.
2. Build scene context extraction from the selected project bundle and scene.
3. Implement a deterministic mock provider.
4. Include provenance in mock provider results.
5. Add tests proving stable output from the same input context.

### Verification

- `pnpm test`
- `pnpm typecheck`

## Task 10: Build Prompt Pack Studio UI and persistence

### Steps

1. Add a Prompt Pack Studio section under the Assets workspace or a closely
   related AI authoring panel.
2. Let the user select a scene and enter an art brief.
3. Show derived context before generation.
4. Run the mock provider and display candidates.
5. Show background, props, characters, animation notes, negative prompt,
   generation targets, suggested actors, and provenance.
6. Persist an approved prompt pack as a project document.
7. Keep suggested actors review-only in this milestone.

### Verification

- `pnpm --filter @pointclick/editor typecheck`
- `pnpm --filter @pointclick/editor build`
- `pnpm validate:sample`

## Task 11: Add integration and preview checks

### Steps

1. Add or update E2E coverage for opening the editor, selecting scene tools, and
   seeing actor or prompt pack controls.
2. Add player coverage for runtime behavior that moves to interaction spots.
3. Verify the sample project still plays through the existing loop.
4. Review the UI at desktop size for visual overlap and mode clarity.

### Verification

- `pnpm test:e2e`
- `pnpm test`
- `pnpm typecheck`
- `pnpm validate:sample`
- `pnpm build`

## Suggested Execution Slices

Slice 1 should cover Tasks 1-4. It establishes the serialized model, project
loading, sample compatibility, and runtime semantics.

Slice 2 should cover Tasks 5-8. It turns the model into a viewport-first editor
and player experience.

Slice 3 should cover Tasks 9-10. It adds Prompt Pack Studio with a mock provider
and prompt pack persistence.

Slice 4 should cover Task 11 and any polish needed to make the workflow
demonstrable.

## Notes

- Keep real provider APIs out of this plan.
- Keep suggested AI actors review-only until the viewport actor model is stable.
- Do not replace pickups immediately; support actors alongside pickups first,
  then decide whether a later migration should unify them.
- Prefer small schema additions and explicit persistence commands over generic
  document patching.
- Runtime state remains serializable and renderer-independent.
