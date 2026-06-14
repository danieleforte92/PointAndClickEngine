# Polygon Walk Areas And Pathfinding Implementation Plan

Date: 2026-06-14
Depends on: `docs/superpowers/specs/2026-06-14-polygon-walkareas-pathfinding-design.md`

## Goal

Implement polygon-based walk areas for layered-2D scenes, add deterministic grid pathfinding in the runtime, and update the editor and sample content to author and validate the new format.

## Task 1: Update contracts and sample data

### Steps

1. Add `Polygon2Schema` and exported `Polygon2` type in `packages/contracts/src/schemas.ts`.
2. Change layered-2D scene documents from `walkArea: Rect` to `walkArea: Polygon2`.
3. Update contract validation tests to use polygon walk areas.
4. Update the sample scene JSON to the new polygon format.

### Verification

- `pnpm test -- --run packages/contracts/src/validate.test.ts`
- `pnpm validate:sample`

## Task 2: Add runtime geometry and pathfinding helpers

### Steps

1. Add a dedicated runtime navigation module for:
   - polygon bounds
   - point-in-polygon checks
   - closest point on polygon edges
   - polygon area / degenerate checks
   - grid generation from the polygon
   - deterministic A* over grid cells
2. Keep the module pure and independent from Pixi or Electron.
3. Add focused unit tests for geometry and pathfinding behavior, including a concave polygon case and an outside-click projection case.

### Verification

- `pnpm test -- --run packages/runtime`

## Task 3: Wire runtime movement to polygon navigation

### Steps

1. Update `AdventureEngine.walkTo()` to use the new navigation helpers for layered-2D scenes.
2. Resolve start and goal cells from world position and click position.
3. Project outside clicks to the nearest walkable boundary point.
4. Preserve safe no-op behavior when no valid path or target can be resolved.
5. Keep current endpoint-style movement for this milestone rather than introducing path playback.

### Verification

- `pnpm test -- --run packages/runtime`
- `pnpm typecheck`

## Task 4: Update project persistence for polygon walk areas

### Steps

1. Change `ScenePatch` in `packages/project-io/src/index.ts` to use `Polygon2`.
2. Update scene patching and validation to write the new walk area shape.
3. Expand `project-io` tests to cover polygon scene updates.

### Verification

- `pnpm test -- --run packages/project-io`

## Task 5: Update editor draft model and scene inspector

### Steps

1. Extend editor scene draft state to store ordered walk-area points as strings.
2. Replace the old rectangle-based walk-area inputs in the scene inspector with vertex editing controls.
3. Add scene-level validation for:
   - at least 3 points
   - numeric coordinates
   - non-zero polygon area
4. Ensure undo/redo and autosave recovery still include scene polygon edits without adding a special-case history path.

### Verification

- `pnpm test`
- `pnpm typecheck`

## Task 6: Add editor preview overlay for walk polygons

### Steps

1. Render the walk polygon overlay in the editor scene preview.
2. Show fill, outline, and vertex markers so polygon edits are easy to inspect.
3. Keep hotspot and player preview behavior intact.

### Verification

- `pnpm --filter @pointclick/editor typecheck`
- `pnpm --filter @pointclick/editor build`

## Task 7: Full integration verification

### Steps

1. Run the full test and typecheck pass.
2. Validate the sample project with the updated scene format.
3. Build and package the editor.
4. Review the diff for schema, runtime, sample content, and editor consistency.

### Verification

- `pnpm test`
- `pnpm typecheck`
- `pnpm validate:sample`
- `pnpm --filter @pointclick/editor build`

## Notes

- Keep this milestone to a single walkable polygon and no explicit obstacles.
- Do not introduce migration tooling yet; just update in-repo sample content and tests.
- Prefer small pure helpers in runtime so later path playback can build on the same navigation outputs.
