# Project Format

A project is a normal Git-friendly directory. The sample lives at
`apps/sample-game/project`.

```text
adventure.project.json
scenes/<id>.scene.json
flows/<id>.flow.json
assets/<id>.asset.json
animation-packs/<id>.animation-pack.json
prompt-packs/<id>.prompt-pack.json
locales/<locale>.json
```

Every document contains `schemaVersion: 1` and a stable kebab-case ID.
The manifest references other documents by ID and relative path.

The CLI validates schemas and verifies that referenced IDs match the loaded
documents:

```powershell
pnpm validate:sample
pnpm validate:starter
```

`validate` checks schemas, cross-document references, and registered asset files.

## Animation Packs

Animation packs bind one spritesheet asset to named clips:

```json
{
  "schemaVersion": 1,
  "id": "mara",
  "name": "Mara MVP Animation Pack",
  "assetId": "mara-spritesheet",
  "frame": { "width": 64, "height": 64 },
  "grid": { "columns": 3, "rows": 2 },
  "footOrigin": { "x": 32, "y": 63 },
  "defaultFacing": "right",
  "clips": [
    { "id": "idle", "frames": [0, 1], "fps": 4, "loop": true },
    { "id": "walk", "frames": [3, 4, 5], "fps": 8, "loop": true }
  ]
}
```

Scenes can assign an animation pack to `player.animationPackId` or
`actors[].animationPackId`. The renderer uses `idle` and `walk` when present and
falls back to static assets or debug shapes when a pack cannot load.

Creator Alpha's Asset Studio includes Character Gym controls for editing frame
grids, foot origins, clip frame lists, and preview loops without manual JSON
edits.

## Scene Layers

Layered 2D scenes can optionally define visual image layers:

```json
{
  "layers": [
    {
      "id": "foreground-fog",
      "name": "Foreground Fog",
      "assetId": "fog-strip",
      "depth": 95,
      "opacity": 0.72,
      "visible": true,
      "locked": false,
      "bounds": { "x": 0, "y": 520, "width": 1280, "height": 200 }
    }
  ]
}
```

`assetId` must point to a registered image asset. `depth` controls draw order
alongside shapes, actors, pickups, and the player. If `bounds` is omitted, the
renderer stretches the layer over the full scene. `locked` is an editor flag; the
runtime ignores it.

## Pickup Assets

Pickups can optionally reference a registered image asset:

```json
{
  "id": "rusty-hook",
  "itemId": "rusty-hook",
  "labelKey": "pickup.rusty-hook",
  "assetId": "rusty-hook-image",
  "bounds": { "x": 300, "y": 560, "width": 70, "height": 60 }
}
```

`assetId` is optional. If it is present, validation requires the asset document
to exist and the renderer draws the image inside the pickup bounds. If it is
absent, the renderer falls back to the debug pickup shape.

## Generation Guides

Prompt-pack generation targets can optionally reference image assets prepared in
Asset Studio:

```json
{
  "id": "rusty-hook",
  "intendedUse": "prop",
  "referenceAssetId": "rusty-hook-reference",
  "maskAssetId": "rusty-hook-mask",
  "guideBounds": { "x": 300, "y": 560, "width": 70, "height": 60 },
  "guideShape": "rect"
}
```

`referenceAssetId` and `maskAssetId` must point to registered image assets.
Creator Alpha stores these guides for review and future image-to-image
workflows; the current ComfyUI text-to-image path does not upload guide images.

## Flow Transitions

Flows can change scenes with a `change-scene` node:

```json
{
  "id": "enter-tavern",
  "type": "change-scene",
  "targetSceneId": "new-scene",
  "playerStart": { "x": 350, "y": 585 },
  "next": "end"
}
```

The transition is applied through the same command/event core as walking,
inventory, and flags.

Current schemas are TypeBox definitions compiled with Ajv. TypeScript types are
derived from the same definitions, preventing the runtime and validators from
drifting apart.

Future migrations must:

- preserve stable IDs;
- run atomically;
- write a backup before mutation;
- support dry-run validation;
- keep caches and generated build output outside canonical project state.
