# Build Your First Two-Scene Adventure

This tutorial uses the checked-in starter project. By the end, you will have a
validated project that can be previewed in the editor or web player.

## Prerequisites

- Node.js 22.17 or newer.
- pnpm 9.6.
- A clean install with `pnpm install`.

## Steps

1. Start the tools:

   ```powershell
   pnpm dev
   ```

2. In the editor, open `apps/starter-game/project`.

3. Use the Scenes workspace to adjust the starter scene name, player start, walk
   area, and one hotspot. Valid field edits autosave after a short pause; asset
   and animation assignments still require their explicit apply action. The
   zoom, grid, overlay, and minimap controls in the canvas toolbar are local view
   preferences and are restored the next time you open the Studio.

4. In **Scenes > Player**, choose a player asset or animation pack, adjust walk
   speed, and tune near/far scale for depth.

5. In **Scenes**, add an optional visual layer from an imported image when you
   need foreground props, fog, overlays, or depth polish.

6. Use the Narrative graph to create or edit a flow. Scene-linked flows show
   their triggering entity, so you can jump back to the hotspot, actor, or pickup
   that invokes the selected flow. Connect a `change-scene` node to the next
   node, choose the target scene, and run diagnostics before leaving the flow.

7. Use Resources or Asset Studio to import image and audio files. Assign an
   imported image as a background or actor asset from the Scene inspector. Add
   an audio asset to a narrative sound node when the flow needs a cue.

8. Optional: use AI Studio to generate a deterministic mock prompt pack. From a
   scene background, actor, pickup, or used image asset, use the AI target action
   to open AI Studio with the matching scene target selected. If LM Studio or
   ComfyUI are running locally, configure those providers to draft prompts or
   generate a temporary image batch. Review and apply one candidate; assignment
   to a scene entity remains a separate action.

9. Choose **Play** to enter Test Lab. The embedded player uses the current editor
   snapshot. Interact with it, open **Browser**, refresh telemetry, and check the
   **Compare** tab for the first logical-state divergence.

10. Validate the saved project:

   ```powershell
   pnpm validate:starter
   ```

The expected result is a valid project with no errors. Warnings identify missing
locale text or optional polish, but errors block preview and release checks.
When the Build workspace lists an actionable issue, open it from the issue row
to land on the related scene entity, narrative flow, asset, prompt target, recipe,
or workflow template.

For task-focused follow-ups such as processing an asset, comparing runtime
tracks, or exporting the web build, see [Studio Workflows](studio-workflows.md).
