# Assets Workspace Registry Design

Date: 2026-06-15
Status: Proposed

## Goal

Turn the editor `Assets` workspace into a real project asset library backed by a
dedicated registry.

This first slice should make the workspace operational for two concrete jobs:

- import external files into the project
- register imported assets in project data and connect image assets to scene backgrounds

This step intentionally builds a durable asset foundation without yet expanding
into AI generation, provenance history, or asset editing workflows.

## Scope

Included:

- a new project asset registry and manifest references
- asset loading through `packages/project-io`
- asset import from external files with copy into the project
- asset listing in the editor `Assets` workspace
- derived usage display for registered assets
- setting an image asset as the background of an existing scene
- missing-file detection for registered assets

Excluded:

- rename, move, or delete asset operations
- drag and drop import
- image editing
- AI asset generation
- advanced provenance, versions, or immutable revisions
- generic linking for all document types

## Why This Shape

The editor now has a clear status surface and a working build-validation
workspace. The next missing operational surface is asset management.

A filesystem-only browser would be quick, but it would not give the project a
stable notion of asset identity. Since the roadmap already points toward
provenance, versioning, and asset workflows, this first asset slice should start
with a real registry instead of a temporary loose-file pattern.

At the same time, the slice stays narrow by supporting only one concrete
downstream use: assigning an image asset as a scene background.

## Approaches Considered

### Option A: Filesystem library without registry

Scan an `assets/` folder and treat files on disk as the source of truth.

Rejected because it would make asset identity unstable and would create a second
migration later when provenance and richer metadata become necessary.

### Option B: Registry-backed asset workspace

Add asset documents and project manifest references, then make the workspace
operate on registered assets rather than raw files.

Chosen because it creates a durable editorial model while still allowing a
tight first implementation.

### Option C: Import utility only

Add import buttons directly to scene inspectors without building a true `Assets`
workspace.

Rejected because it would scatter asset behavior across the UI and would not
solve the original problem of making the `Assets` workspace genuinely useful.

## Data Model

### Asset document

Add a new project document type for assets.

Minimum fields for this step:

- `id`
- `schemaVersion`
- `kind`
- `path`
- `source`

Suggested values:

- `kind`: starts with `image`
- `source`: starts with `imported`

This document represents the editor-facing identity of an asset. The filesystem
path is part of the document, but the registry is the authoritative layer.

### Project manifest

Extend the project manifest with asset references, parallel to scenes, flows,
items, and locales.

Each reference should include:

- `id`
- `path`

The manifest remains the single project entry point for loading content.

### Usage model

Usage should be derived in this first step, not stored as authoritative asset
metadata.

Example:

- if a scene background points to an asset path, the workspace reports that
  scene as a current usage of the asset

This avoids two sources of truth between registry metadata and scene documents.

## Workspace Behavior

The `Assets` workspace becomes a real library surface with:

- asset catalog
- selected asset detail
- import action
- image-only action to set the selected asset as a scene background

### Catalog

The asset list should show:

- asset id
- kind
- path
- simple health state:
  - available
  - missing file

### Detail panel

For the selected asset, show:

- id
- kind
- source
- project-relative path
- usage list derived from project documents

### Import flow

The user chooses one or more external files.

The editor then:

1. copies each file into a project asset directory such as `assets/imported/`
2. generates a stable asset id
3. writes asset document files and manifest references
4. reloads the project snapshot

### Scene background assignment

When the selected asset is an image, the workspace should expose an action to
set it as the background for an existing scene.

This action should reuse the existing `scene/update` persistence path rather
than inventing a second write path.

## Architecture

### `packages/contracts`

Add:

- asset schema and exported type
- manifest support for asset references

### `packages/project-io`

Responsibilities:

- load registered assets from the manifest
- validate asset documents
- validate referenced asset files
- support import persistence for newly registered assets
- expose loaded assets in the project bundle

Potential command surface:

- `asset/import`
- optional `asset/update` only if needed by implementation

This step should keep commands explicit and avoid a generic patch engine.

### Editor main/preload

Responsibilities:

- open native file picker for external files
- copy selected files into the project asset directory
- call the appropriate project persistence command
- return a fresh project snapshot

### Editor renderer

Responsibilities:

- render the `Assets` workspace
- display asset catalog and selected asset details
- show missing-file state
- trigger import
- trigger background assignment

## Persistence And File Layout

Recommended project layout for imported files:

- `assets/imported/<filename>`
- `assets/<asset-id>.asset.json` or equivalent asset document path

The exact asset document location can be chosen for consistency with the
existing project structure, but it should be stable and manifest-driven.

Imported files should be copied, not linked in place. The project must own the
imported bytes.

If a filename already exists, the import process should generate a unique target
name rather than fail immediately.

## Validation Rules

Validation should cover at least:

- asset reference ids in the manifest must match loaded asset documents
- asset document `path` must remain project-relative
- registered asset files must exist on disk
- only supported image assets are assignable as scene backgrounds

Missing asset files should surface as diagnostics and as asset health state in
the workspace.

## Error Handling

### Import collisions

If an imported filename already exists in the project, generate a unique name.

### Copy or persistence failures

If file copy or asset registration fails, the workspace should surface a clear
error and avoid pretending the import succeeded.

### Missing registered files

If an asset document exists but the file is gone, show the asset as broken
without crashing the workspace.

### Unsupported background assignment

If the selected asset is not an image, the background action should be hidden or
disabled with clear feedback.

## Testing

Add focused coverage for:

- contracts validation for asset documents and manifest asset references
- `project-io` load and import behavior for assets
- missing-file diagnostics
- derived asset usage detection
- background assignment flow using existing scene persistence

Verification pass:

- `pnpm test`
- `pnpm typecheck`
- `pnpm --filter @pointclick/editor build`

## Implementation Sequence

1. add asset schemas and manifest support in `packages/contracts`
2. extend `packages/project-io` loading, validation, and import persistence
3. extend editor snapshot typing and bridge APIs for asset import
4. implement the `Assets` workspace catalog and detail UI
5. wire image background assignment through existing scene updates
6. add focused tests and run verification

## Risks And Limits

- introducing a registry now is more work than a loose file browser, but it
  avoids a messy migration later
- usage derivation must stay simple in this step so the workspace does not
  become tightly coupled to every content type at once
- imported file naming needs to be deterministic enough to stay understandable
  for users while still avoiding collisions

## Done Criteria

This step is complete when:

- the project manifest can reference registered assets
- imported files are copied into the project and persisted in the asset registry
- the editor `Assets` workspace shows catalog, health, and derived usage
- an image asset can be assigned as a scene background
- automated checks pass
