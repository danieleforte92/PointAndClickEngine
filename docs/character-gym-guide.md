# Character Gym Guide

Character Gym is the MVP workflow for reusable spritesheet animation packs.
Creator Alpha has runtime support, project document support, and editor controls
for creating/updating packs from the Asset Studio.

## Pack Shape

An animation pack stores:

- `assetId`: registered spritesheet image asset.
- `frame`: width and height of one frame.
- `grid`: column and row count.
- `footOrigin`: pixel pivot used for player grounding.
- `clips`: named frame lists with `fps` and `loop`.

Use clip IDs `idle`, `walk`, and `talk` for renderer compatibility. Extra clips
can be saved for future tooling.

## Assign A Pack

Add the pack to `animationPacks` in `adventure.project.json`, then assign it in
a scene or through the editor's Player/Actor controls:

```json
"player": {
  "animationPackId": "mara",
  "scaleFar": 0.62,
  "scaleNear": 1.08,
  "walkSpeed": 320
}
```

Actors can use the same field:

```json
"animationPackId": "mara"
```

The renderer uses `walk` while the player interpolates and returns to `idle` at
the destination. If a pack or asset is missing, validation reports an error and
the renderer falls back to visible debug shapes where possible.

## Editor MVP

The Creator Alpha editor exposes these controls without manual JSON edits:

- select spritesheet asset;
- set frame width/height and grid columns/rows;
- set foot origin and default facing;
- edit `idle`, `walk`, and `talk` clips with frame lists, fps, and loop flag;
- preview the focused clip as an animation while editing draft values;
- assign the pack to the current scene player or selected actor.

The clip preview uses the current draft and updates before saving. Focus or edit
a clip row to preview that clip; otherwise the editor previews `idle` or the
first available clip. Visual frame slicing remains follow-up UX work.

## AI Asset Studio Connection

Use prompt-pack targets to generate source material for Character Gym:

- **Character Full Body Chroma** for a clean base design;
- **Character Turnaround** for consistent proportions;
- **Walk Cycle Reference** for animation planning;
- **Dialogue Portrait Sheet** for future portrait support.

For sprite work, prefer ComfyUI workflows that output chroma or transparent PNGs.
If the workflow does not preserve alpha, import the result as a reference asset
and keep the animation pack tied to a cleaned spritesheet.
