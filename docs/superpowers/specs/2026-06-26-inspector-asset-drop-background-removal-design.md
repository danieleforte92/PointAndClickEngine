# Inspector Asset Drop and Background Removal Design

## Context

Creator Alpha already supports image asset import, asset library assignment, ComfyUI image generation, and alpha/chroma output warnings. The current manual workflow is still too indirect: a creator working on a scene entity must leave the entity inspector, import an image through Assets, then come back and select the asset id. Chroma cleanup is also external-only, so blue/green-background character and prop outputs cannot be turned into transparent-ready PNGs inside the editor.

This design adds an inspector-first asset workflow:

- drag and drop image files directly onto Scene, Player, Actor, and Pickup inspectors;
- import the dropped image into the project asset library;
- assign the new asset immediately to the selected entity;
- provide an in-editor chroma background remover with preview and save-as-new-asset behavior.

## Goals

- Make manual asset import usable while editing the exact entity that needs the asset.
- Support Scene background, Player asset, Actor asset, and Pickup/Prop asset assignment from the same interaction model.
- Add `pickup.assetId` to the shared contract so pickup props can render and validate like actor props.
- Keep file writes in the Electron main process; the renderer should request imports and processed image saves, not write files directly.
- Make chroma cleanup useful for current blue/green generation defaults without promising AI segmentation or manual brush editing.

## Non-Goals

- No AI segmentation, matting model, or remote background-removal provider.
- No manual eraser/restore brush in this slice.
- No batch cleanup queue.
- No destructive overwrite of the original imported image; processed output is saved as a new asset.
- No broad redesign of Asset Studio.

## User Experience

Each relevant inspector gets a compact asset drop zone near its existing asset controls.

- Scene inspector: dropping an image imports it and assigns its project-relative path as the scene background.
- Player inspector: dropping an image imports it and assigns the imported asset id to `scene.player.assetId`.
- Actor inspector: dropping an image imports it and assigns the imported asset id to `actor.assetId`.
- Pickup inspector: dropping an image imports it and assigns the imported asset id to `pickup.assetId`.

The drop zone shows the currently assigned image preview when available, a checkerboard background for transparent images, and clear status for missing assets. It also exposes small actions:

- `Import`: opens the existing file picker and applies the same assignment behavior.
- `Remove Background`: opens the chroma cleanup tool for the current assigned image.
- `Open Asset`: switches to the asset document in Asset Studio.

Assignment follows existing draft semantics where applicable. Actor, Pickup, and Player inspector changes become draft changes and still require the existing save/apply action. Scene background assignment follows the existing scene draft/update path used by the editor. Importing the asset itself is persisted immediately because asset documents are project-level files.

## Background Removal Tool

The tool is a focused modal/workspace panel backed by browser canvas.

Inputs:

- source image asset;
- key color, initially inferred from the target contract when known or defaulting to blue `#00A2FF`;
- color picker by clicking the image;
- tolerance slider;
- feather slider for soft alpha edges;
- optional spill reduction toggle for blue/green edge contamination.

Preview:

- source and processed views side by side on checkerboard;
- zoom-to-fit with stable dimensions;
- transparent-pixel summary and warning if no pixels are removed;
- output preview uses the same dimensions as the source image.

Save behavior:

- renderer computes the processed PNG via canvas and sends the encoded PNG bytes or data URL to the main process;
- main process writes it to `assets/imported` with a derived name like `<asset-id>-alpha.png`;
- project-io registers it as a normal image asset;
- user can save and assign to the current Scene, Player, Actor, or Pickup in one action.

## Architecture

### Contracts

Extend `ScenePickupSchema` with optional `assetId: Id`.

Validation additions:

- missing pickup asset produces a semantic diagnostic similar to `scene.actor-asset-missing`;
- asset reference discovery includes pickup asset use so referenced assets cannot be deleted accidentally;
- pickup asset id is included in project load snapshots and editor draft state.

### Main Process

Add reusable asset import helpers around the existing import code:

- `importImageFiles(filePaths: string[])`;
- `importImageBytes({ filenameHint, bytes })`;
- both copy or write into `assets/imported`, generate unique asset ids, create asset documents, and apply the existing `asset/import` command.

IPC additions:

- `project:import-asset-files` accepts file paths from drag/drop or file picker selection;
- `project:save-processed-image-asset` accepts a filename hint and PNG bytes/data URL from the renderer.

The main process validates extensions and project paths. Dropped external files are copied into the project; project-relative output is always created by the main process.

### Renderer

Add a small `EntityAssetDropZone` component that receives:

- assigned asset id/path;
- preview URL;
- missing/error state;
- entity label;
- drop/import callbacks;
- cleanup/open callbacks.

Use it in:

- Scene inspector for background path assignment;
- Player inspector for `playerAssetId`;
- Actor inspector for `actor.assetId`;
- Pickup inspector for new `pickup.assetId`.

Add chroma cleanup helpers as pure functions:

- parse color;
- compute color distance;
- compute alpha from tolerance and feather;
- apply chroma key to `ImageData`;
- summarize alpha result.

The UI can then be tested without requiring Electron image APIs.

## Data Flow

1. User drops an image on an inspector drop zone.
2. Renderer reads the dropped file path from Electron drag data and calls `project:import-asset-files`.
3. Main process copies the file into `assets/imported`, registers an asset document, and returns the updated snapshot plus imported asset ids.
4. Renderer updates project state and applies the assignment to the active entity draft.
5. User optionally opens Remove Background.
6. Renderer loads the assigned asset preview URL, processes pixels in canvas, and previews alpha on checkerboard.
7. User saves processed PNG.
8. Main process writes and registers a new asset.
9. Renderer assigns the processed asset to the current entity draft when requested.

## Error Handling

- Drop with no project open: show a status message and ignore the drop.
- Unsupported file type: reject before import with a clear message.
- Multiple files dropped on an entity: import all, assign the first image, report how many were imported.
- Missing assigned asset: preserve the current diagnostic pattern and allow replacing via drop/import.
- Cleanup on non-image asset: disable Remove Background.
- Cleanup result removes no pixels: allow saving but show a warning.
- Canvas load failure: keep the source asset unchanged and show the error in the cleanup panel.

## Testing

- Contract validation accepts pickup `assetId`.
- Semantic diagnostics report missing pickup assets.
- Asset reference discovery blocks deleting an asset referenced by a pickup.
- Main process/import helper registers dropped file imports and processed PNG imports.
- Chroma helper tests cover exact key removal, tolerance, feather, and opaque no-op behavior.
- Renderer-level tests cover assignment decisions where existing test harness support allows it.
- Existing `pnpm test` and editor typecheck remain required.

## Open Implementation Notes

- Electron file drops expose paths in renderer in this app context; if a platform does not expose paths, the fallback is the explicit `Import` button.
- Pickup rendering should mirror actor image rendering where possible, using pickup bounds and `assetId`.
- Processed image metadata stays in the normal asset document for this slice; richer provenance can be added later.
