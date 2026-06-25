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

3. Use the Scene workspace to adjust the starter scene name, player start, walk
   area, and one hotspot. Save each inspector change with **Apply changes**.

4. Use the Narrative workspace to create or edit a flow. For a second scene,
   add a `change-scene` node and choose the target scene.

5. Use the Assets workspace to import image files. Assign an imported asset as a
   background or actor asset from the Scene inspector.

6. Preview with **Play from here**. The preview uses unsaved drafts when launched
   from the editor.

7. Validate the saved project:

   ```powershell
   pnpm validate:starter
   ```

The expected result is a valid project with no errors. Warnings identify missing
locale text or optional polish, but errors block preview and release checks.
