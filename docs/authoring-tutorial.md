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
   area, and one hotspot. Save each inspector change with **Apply changes**.

4. In **Scenes > Player**, choose a player asset or animation pack, adjust walk
   speed, and tune near/far scale for depth.

5. In **Scenes**, add an optional visual layer from an imported image when you
   need foreground props, fog, overlays, or depth polish.

6. Use the Narrative workspace to create or edit a flow. For a second scene,
   add a `change-scene` node and choose the target scene.

7. Use Asset Studio to import image files. Assign an imported asset as a
   background or actor asset from the Scene inspector.

8. Optional: use AI Studio to generate a deterministic mock prompt pack.
   If LM Studio or ComfyUI are running locally, configure those providers to
   draft prompts or generate an imported image asset.

9. Preview with **Play from here**. The preview uses unsaved drafts when launched
   from the editor.

10. Validate the saved project:

   ```powershell
   pnpm validate:starter
   ```

The expected result is a valid project with no errors. Warnings identify missing
locale text or optional polish, but errors block preview and release checks.
