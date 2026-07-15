# Creator Alpha v0.4.0-alpha.3 Release Notes

Creator Alpha v0.4.0-alpha.3 is the distribution and accessibility alpha for
Point & Click Engine. It is a Windows-first prerelease for contributors and
early creators who are comfortable with local developer tools. The candidate
extends the runtime foundation and narrative authoring work with saves,
migration, static web export, player accessibility, and verified packaging.

Release page: publish this candidate as GitHub prerelease tag
`v0.4.0-alpha.3`.

## Public Walkthrough

- [Scene editor](https://github.com/danieleforte92/PointAndClickEngine/blob/v0.4.0-alpha.3/docs/assets/scene_editor.jpg)
- [Player showcase loop](https://github.com/danieleforte92/PointAndClickEngine/blob/v0.4.0-alpha.3/docs/assets/player.jpg)
- [AI Studio with Advanced and Candidate Output](https://github.com/danieleforte92/PointAndClickEngine/blob/v0.4.0-alpha.3/docs/assets/ai-studio-advanced.png)
- [Asset Studio mock asset surface](https://github.com/danieleforte92/PointAndClickEngine/blob/v0.4.0-alpha.3/docs/assets/asset_studio.jpg)

## What To Try First

1. Run `corepack enable`, `pnpm install --frozen-lockfile`, and `pnpm dev` with
   Node.js 22.17.0 and pnpm 9.6.0.
2. Open `apps/sample-game/project` and play the look, pickup, use, dialogue,
   and scene-transition loop.
3. Edit a walk area and test waypoint movement plus an interaction that waits
   for `movement/completed`.
4. Create manual saves, trigger autosave, restore a slot, and test browser or
   Electron persistence.
5. Run `pointclick migrate` on a v1 fixture in dry-run and backup mode, then
   validate the migrated project.
6. Inspect Flow graph diagnostics and puzzle dependencies in the editor.
7. Export the sample as a static web build and open the generated output.
8. Exercise keyboard focus, captions, reduced motion, contrast-oriented
   controls, and a narrow browser viewport.
9. Generate a mock prompt pack, review and apply an image candidate, then use
   Test Lab and **Browser** to compare runtime traces.

## Included

- Electron editor and web player for layered 2D scenes, hotspots, pickups,
  actors, player setup, assets, prompt packs, and validation.
- Deterministic navigation waypoints, pending interactions, and path progress.
- Versioned saves with three manual slots, one autosave, stable checkpoints,
  validation, corruption detection, project fingerprints, and storage adapters.
- Schema-v2 migration with dry-run, backup, staging, rollback, and fixture
  coverage.
- Flow VM conditions, choices, sub-flows, inventory commands, waits, scene
  triggers, presentation cues, graph diagnostics, and puzzle dependencies.
- Audio assets, scene music/ambience, SFX, optional voice lines, captions,
  mute, and channel volume controls.
- Static web export with relative assets and browser save storage.
- Keyboard navigation, focus management, reduced-motion behavior, and
  accessibility-oriented player controls.
- Windows package verification for the portable editor, ZIP, and Squirrel
  installer outputs.
- Local-first AI workflows with mock prompt generation, LM Studio, experimental
  opt-in cloud providers, and ComfyUI image import. The deterministic mock
  path remains usable without provider accounts, keys, or model downloads.

## Known Limitations

- This is an alpha candidate; Windows is the primary packaged target.
- The Windows x64 package is unsigned. Signing requires a separate authorized
  certificate and recorded evidence before a non-alpha stable release.
- Flow authoring includes the built-in typed node graph, diagnostics, dependency
  inspection, minimap, deterministic layout, and persisted editor positions;
  custom node plugins remain out of scope.
- Character Gym remains an MVP workflow and generated animation-sheet
  consistency needs stronger presets.
- Transparent PNG quality depends on the selected ComfyUI workflow or a clean
  flat chroma source for editor cleanup.
- Reference and mask inputs require a compatible installed ComfyUI template or
  legacy API workflow; plain text-to-image paths do not use image inputs.
- Hosted web demo, marketing site, SDK publishing, and autonomous puzzle AI are
  outside this candidate. Cloud providers remain experimental and optional.

## Release Gate

Before tagging, run:

```powershell
pnpm check
pnpm audit --audit-level high
pnpm test:e2e
pnpm check:release:candidate
pnpm validate:provenance:strict
pnpm verify:windows-package
pnpm --filter @pointclick/editor make
pnpm test:e2e:packaged
```

Also complete the manual smoke test in `docs/release-checklist.md`. Do not
claim signing or manual smoke completion without recording the actual evidence.
