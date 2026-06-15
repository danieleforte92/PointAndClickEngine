# Assets Workspace Maintenance Design

Date: 2026-06-15
Status: Proposed

## Goal

Extend the editor `Assets` workspace from import and catalog behavior into a
real maintenance surface for registered project assets.

This step adds three core maintenance actions:

- rename asset
- relink broken or replaceable asset files
- delete unused assets

The purpose is to make the asset library trustworthy over time, not just easy
to populate once.

## Scope

Included:

- derived asset states:
  - `in-use`
  - `unused`
  - `broken`
- asset rename
- asset relink
- asset delete for unused assets
- reference updates for documents that use asset paths directly
- clear blocking behavior for deleting assets still in use

Excluded:

- cascading delete with automatic unlink across the project
- folder restructuring tools
- bulk asset operations
- drag and drop relink
- image editing
- AI generation or provenance upgrades

## Why This Shape

The first `Assets` slice established a registry, import flow, and scene
background assignment. That makes the workspace useful, but still incomplete in
day-to-day maintenance.

Without rename, relink, and delete, the registry becomes sticky: broken entries
accumulate, naming mistakes become permanent, and unused assets linger with no
cleanup path. This slice closes that operational gap before the project depends
more heavily on asset-based authoring.

## Approaches Considered

### Option A: UI-driven orchestration across multiple writes

Let the editor main process move files and then issue several independent
updates to manifest and content documents.

Rejected because it increases the chance of partial state and spreads ownership
across too many layers.

### Option B: Explicit `project-io` maintenance commands

Add targeted commands for rename, relink, and delete, with persistence and
reference updates handled transactionally in one place.

Chosen because it matches existing editor persistence patterns and keeps file
and project-document changes together.

### Option C: Soft-delete only

Mark assets as inactive rather than removing them.

Rejected for this slice because it avoids the hard parts without solving actual
project cleanup.

## Asset State Model

Every registered asset should expose one derived state:

- `in-use`
- `unused`
- `broken`

### `broken`

The asset is registered but its file is missing on disk.

### `in-use`

At least one project document references the asset path.

### `unused`

The asset is registered, its file exists, and no project document currently
uses it.

This state should remain derived rather than stored inside the asset document.

## Workspace Behavior

### Rename

Rename should:

- update `asset.id`
- update manifest asset reference ids
- update the asset document file path if the document naming convention depends
  on the id
- optionally rename the imported file if implementation keeps asset filenames
  aligned with ids
- update any project documents that reference the asset path directly

This action should be blocked when:

- the new id is invalid
- the new id already exists

### Relink

Relink should:

- keep the same logical asset identity when possible
- copy a replacement file into the project
- update `asset.path`
- update all document references that currently point at the old asset path

This is especially important for `broken` assets, but it can also support normal
replacement of an existing asset file.

### Delete

Delete should:

- be allowed only when the asset is `unused`
- remove the imported file when present
- remove the asset document
- remove the asset reference from the manifest

Delete should be blocked for `in-use` assets with clear feedback.

If an asset is `broken` and also `unused`, delete may still proceed because the
registry cleanup remains valid even if the file is already gone.

## Architecture

### `packages/project-io`

Add explicit commands:

- `asset/rename`
- `asset/relink`
- `asset/delete`

Responsibilities:

- validate requested operation
- update asset document and manifest references
- update content documents that use the asset path directly
- perform file operations needed by the asset maintenance action
- reload and return a fresh project snapshot

This package remains the source of truth for persistence behavior.

### Editor main/preload

Responsibilities:

- expose the new maintenance actions through IPC
- open file picker for relink
- leave persistence semantics to `project-io`

### Editor renderer

Responsibilities:

- render derived asset states
- enable or disable actions based on state
- collect rename input
- trigger relink
- trigger delete
- surface blocking and failure feedback clearly

## Reference Update Model

Current project documents store asset usage by direct path, not by asset id.

That means rename and relink must update consumers transactionally.

For this slice, the known direct consumer is:

- `scene.background`

The implementation should centralize path replacement logic so future
asset-consuming document types can be added without scattering update rules.

## Error Handling

### Rename failure

If the id is invalid or already in use, fail before any write begins.

If a file rename or write fails mid-operation, the command should not leave the
project with partially updated references.

### Relink failure

If copying the replacement file fails, the asset document and content references
must remain unchanged.

If the target filename collides, generate a unique project-local name.

### Delete failure

If the asset is `in-use`, return a clear error and do not mutate project state.

If the asset file is already missing but the asset is `unused`, delete may still
remove registry and manifest state.

## Testing

Add focused coverage for:

- rename updates asset identity and all affected references
- relink swaps file path and updates consumers
- delete removes an unused asset from registry and manifest
- delete is blocked for assets in use
- derived asset state calculation for `in-use`, `unused`, and `broken`

Verification pass:

- `pnpm test`
- `pnpm typecheck`
- `pnpm --filter @pointclick/editor build`

## Implementation Sequence

1. add asset maintenance command types in `project-io`
2. implement reference-aware rename, relink, and delete behavior
3. expose maintenance actions through editor preload/main
4. extend the `Assets` workspace UI with state badges and controls
5. add focused tests
6. run verification

## Risks And Limits

- direct path references make maintenance a little heavier than an id-only model
- rename and relink must stay transactional enough to avoid partial updates
- this slice still handles only currently known asset consumers; more document
  types will need to plug into the same reference-update mechanism later

## Done Criteria

This step is complete when:

- the `Assets` workspace shows `in-use`, `unused`, and `broken` states
- an asset can be renamed without breaking references
- a broken asset can be relinked
- an unused asset can be deleted
- an in-use asset cannot be deleted
- automated checks pass
