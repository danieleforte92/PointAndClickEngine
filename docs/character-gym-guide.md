# Character Gym Guide

Character Gym is the MVP workflow for reusable spritesheet animation packs.

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

Add the pack to `animationPacks` in `adventure.project.json`, then assign it in a
scene:

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
