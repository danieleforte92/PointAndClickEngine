# Scene And Locale Authoring Design

Date: 2026-06-14
Status: Proposed

## Goal

Extend the current editor vertical slice so it can persist edits for:

- the selected layered 2D scene document
- the selected locale document, including new string keys

This step is intentionally narrow. It does not include flow editing, viewport-based walk area editing, or generic document editing infrastructure.

## Scope

Included:

- `scene/update` command persisted through `packages/project-io`
- `locale/upsert` command persisted through `packages/project-io`
- editable scene inspector for:
  - `name`
  - `background`
  - `playerStart`
  - `walkArea`
- editable locale inspector for:
  - browsing existing key/value pairs
  - updating existing values
  - inserting new key/value pairs
- project reload after each successful command
- tests for scene and locale persistence

Excluded:

- `flow/update`
- viewport manipulation for `walkArea`
- deleting locale keys
- adding/removing scenes or locales
- multi-document transactions

## Why This Shape

We already have a working persistence path for hotspot edits:

- renderer UI creates a command
- preload exposes the command API
- editor main process forwards the command
- `packages/project-io` validates and writes the document
- the editor reloads the project snapshot

This step keeps using that path. That gives us a real authoring loop without inventing a second editing architecture too early.

## Approach

### Option A: Focused document commands

Add explicit commands for scenes and locales.

This is the chosen option because it matches the current codebase, keeps validation close to document writes, and gives the editor predictable affordances for each document type.

### Option B: Generic patch engine

Represent edits as generic JSON paths and values.

Rejected for now because it would make validation and UI behavior more abstract than needed at this stage.

### Option C: Raw JSON editing UI

Expose scene and locale JSON directly with schema validation on save.

Rejected for now because it would move too much complexity onto the user and weaken the editor's role as a structured tool.

## Architecture

### `packages/project-io`

`EditorProjectCommand` becomes a discriminated union:

- `hotspot/update`
- `scene/update`
- `locale/upsert`

New types:

- `ScenePatch`
- `LocaleUpsertPatch` or direct `key` / `value` payload on the command

Responsibilities:

- resolve the referenced file from the manifest
- load the current project
- patch only the addressed document
- validate the patched document with existing contracts
- write the updated JSON file
- reload and return the full project snapshot

### Editor main/preload bridge

No architectural change is needed. The existing command pipe stays the same:

- renderer calls `window.pointClick.applyCommand(...)`
- preload forwards via IPC
- main process applies the command and returns a fresh snapshot

Only the TypeScript command union and snapshot selection metadata need to grow.

### Editor UI

The project tree gains locale selection, not just display.

The inspector becomes context-sensitive:

- selected hotspot: existing hotspot editor
- selected scene with no hotspot focus: scene editor
- selected locale: locale editor

This keeps the editor mentally simple: one active thing, one inspector.

## Data Model Changes

### Scene update

`scene/update` will support layered 2D scenes only in this step. Editable fields:

- `name`
- `background`
- `playerStart.x`
- `playerStart.y`
- `walkArea.x`
- `walkArea.y`
- `walkArea.width`
- `walkArea.height`

If the selected scene is not `layered-2d`, the command must fail with a clear error.

### Locale upsert

`locale/upsert` targets one locale document and one string entry:

- if the key exists, replace its value
- if the key does not exist, create it

This operation is intentionally additive-only for keys. No delete behavior is included in this step.

## Validation Rules

### Scene

- `background` must remain a valid `#RRGGBB` string
- `playerStart` values must be finite numbers
- `walkArea.width` and `walkArea.height` must stay above zero
- full scene document must pass `assertDocument`

### Locale

- locale key must be non-empty after trim
- locale value must be a string
- full locale document must pass `assertDocument`

## UI Design

### Scene inspector

Shown when a scene is active and no hotspot is selected.

Fields:

- scene name
- background hex
- player start (`x`, `y`)
- walk area (`x`, `y`, `width`, `height`)

Action:

- single `Apply changes` button

Behavior:

- local draft state mirrors the current scene
- save keeps the current scene selected after reload
- validation errors are surfaced in the existing status area

### Locale inspector

Shown when a locale is selected from the project tree.

Sections:

- existing string list
- editable value field per key
- small add form with:
  - new key
  - new value
  - add/update action

Behavior:

- editing an existing value updates that exact key
- adding a new key uses the same `locale/upsert` command
- locale list order can remain simple object iteration for now

## Error Handling

Failures should remain explicit and local:

- invalid numeric or color input is blocked in the renderer before IPC
- missing scene or locale references fail in `project-io`
- schema validation failures surface the thrown error message in the status area

There is no partial save behavior. Each command updates one document or fails.

## Testing

Add `project-io` tests for:

- `scene/update` writes updated scene fields to disk and reloads correctly
- `locale/upsert` updates an existing key
- `locale/upsert` inserts a new key

Verification pass:

- `pnpm test`
- `pnpm typecheck`
- `pnpm validate:sample`
- `pnpm --filter @pointclick/editor typecheck`
- `pnpm --filter @pointclick/editor build`

## Implementation Notes

Suggested sequence:

1. extend `project-io` commands and file writers
2. add tests for scene and locale persistence
3. extend preload/main command typing if needed
4. add scene draft state and scene inspector save flow
5. add locale selection state and locale inspector save flow
6. run validation and package build

## Risks And Limits

- the inspector is becoming polymorphic, so state resets must be handled carefully when switching between hotspot, scene, and locale
- locale editing without search may get crowded for large string sets, but the sample project size keeps this acceptable for now
- scene editing remains form-based only; direct manipulation is deferred to keep this slice stable

## Done Criteria

This step is complete when:

- scene metadata edits persist to the selected scene file
- locale string edits and insertions persist to the selected locale file
- the editor reflects saved changes after reload without losing current context
- automated validation passes
