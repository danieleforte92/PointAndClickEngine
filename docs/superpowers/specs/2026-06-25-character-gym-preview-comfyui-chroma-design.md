# Character Gym Preview And ComfyUI Chroma Design

## Context

Creator Alpha already has Character Gym document support, editor controls for
animation packs, and ComfyUI image import. The next roadmap step is to make clip
authoring visible while keeping ComfyUI transparency/chroma support bounded to
workflow guidance.

This design covers one implementation slice:

- animated clip preview in Character Gym;
- clearer ComfyUI target guidance for transparent/chroma workflows;
- a small extension point for future local chroma-key post-processing.

It does not add visual frame slicing or local image post-processing in this
slice.

## Character Gym Preview

The Asset workspace's Character Gym card gains one preview panel above the clip
editor list. The preview is always tied to the current draft, so changes to the
spritesheet asset, frame size, grid, foot origin, clip frames, fps, and loop flag
are reflected before saving the animation pack.

The selected preview clip follows lightweight focus:

- default to `idle` when available;
- otherwise use the first draft clip;
- update when a user focuses or edits a clip row.

The preview uses the existing `window.pointClick.resolveAssetUrl` path and the
existing `assetPreviewUrls` cache. No new IPC surface is required.

Rendering is React/CSS-based. A helper derives the current frame index from the
clip frames, fps, loop flag, grid dimensions, and elapsed time. The UI displays a
single sprite cell by applying `background-image`, `background-size`, and
`background-position` to a fixed preview element. This avoids adding Pixi to the
editor UI path and keeps the preview independent from runtime renderer state.

The preview must tolerate incomplete drafts. Instead of throwing or blocking
editing, it shows a compact status for:

- missing image asset;
- unresolved asset URL;
- invalid frame or grid numbers;
- empty or invalid frame list;
- frame index outside the configured grid.

## ComfyUI Transparent/Chroma Guidance

The ComfyUI panel remains workflow-guided. The editor does not alter generated
pixels in this slice.

The UI should make target expectations clearer by deriving a target workflow
description from the selected generation target and output preset. The copy
distinguishes:

- opaque scene/background output;
- transparent target where the workflow must save alpha;
- chroma target where the workflow should generate on a flat key color;
- alpha/chroma limitations when the selected workflow may still save RGB PNG.

The prompt preview and status area should surface the selected target mode so
the user can see the limitation before queueing a job. The imported asset remains
a normal image asset under `assets/imported`.

## Future Chroma-Key Extension

The implementation should isolate ComfyUI target mode decisions in helper
functions, for example `describeImageTargetWorkflow(...)` or equivalent. A later
local chroma-key MVP can then hook into the pipeline after ComfyUI image download
and before asset import without rewriting the renderer UI.

The future extension is intentionally outside this slice. It would add
configuration for key color/tolerance, perform PNG alpha conversion locally, and
validate whether the saved PNG includes alpha.

## Data Flow

Character Gym preview:

1. User edits the animation pack draft.
2. The selected spritesheet asset id maps to an existing image asset path.
3. The editor resolves and caches that asset URL.
4. Preview helpers parse draft numbers and frame lists.
5. The preview panel advances frames on a timer and updates CSS background
   positioning.

ComfyUI guidance:

1. User selects a prompt-pack generation target and ComfyUI output preset.
2. Helper code derives a target workflow description from `transparent`,
   intended use, preset id, and dimensions.
3. The UI displays mode-specific guidance before generation.
4. Generation/import behavior remains unchanged.

## Components

- `editor-app.tsx`: adds preview state, helper calls, Character Gym preview UI,
  and ComfyUI target guidance rendering.
- `editor.css`: adds compact preview panel styling and responsive behavior.
- Focused helper functions: parse and validate preview frames, derive current
  preview cell, and describe ComfyUI target mode.
- Existing docs: update Character Gym and AI prompt-pack guides to describe the
  new preview and workflow-guided transparency/chroma behavior.

## Error Handling

Preview errors are non-fatal UI states. They update the preview panel text and
do not change save validation behavior.

ComfyUI generation errors remain handled by the existing queue/download/import
flow. The new guidance must not imply that the editor guarantees alpha output
unless a workflow actually saves alpha.

## Testing

Add focused unit coverage for pure helpers:

- valid frame selection across fps, loop, and elapsed time;
- invalid draft/grid/frame-list preview states;
- ComfyUI target workflow descriptions for opaque, transparent, and chroma-like
  targets.

Run the existing typecheck and relevant test suite after implementation.

