# Creator Alpha v0.1.1-alpha.1 Release Notes

Creator Alpha v0.1.1-alpha.1 is the stabilization prerelease for Point & Click
Engine. It is a Windows-first technical alpha for contributors and early
creators who are comfortable with local developer tools. The 0.1.x line keeps
schema-v1 project compatibility; it is not a general web export, an SDK, or a
promise of full puzzle AI.

Release page: publish this candidate as GitHub prerelease tag `v0.1.1-alpha.1`.

## Public Walkthrough

- [Scene editor](https://github.com/danieleforte92/PointAndClickEngine/blob/v0.1.1-alpha.1/docs/assets/scene_editor.jpg)
- [Player showcase loop](https://github.com/danieleforte92/PointAndClickEngine/blob/v0.1.1-alpha.1/docs/assets/player.jpg)
- [AI Studio with Advanced and Candidate Output](https://github.com/danieleforte92/PointAndClickEngine/blob/v0.1.1-alpha.1/docs/assets/ai-studio-advanced.png)
- [Asset Studio mock asset surface](https://github.com/danieleforte92/PointAndClickEngine/blob/v0.1.1-alpha.1/docs/assets/asset_studio.jpg)

## What To Try First

1. Run `corepack enable`, `pnpm install --frozen-lockfile`, and `pnpm dev` with
   Node.js 22.17.0 and pnpm 9.6.0.
2. Open `apps/sample-game/project`.
3. Move a scene hotspot, pickup, player start, or walk-area point.
4. Generate a mock prompt pack in **AI Studio**, or open AI Studio from a scene
   background, actor, pickup, or used image asset to keep the target selected.
5. Import or drop an image asset in an inspector.
6. Use **Remove Background** on a flat blue/green chroma image and save the
   result as a new PNG asset.
7. Run validation in **Build**, open any actionable diagnostic to jump to its
   source object, then preview with **Play from here** and **Browser**.

## Included

- Electron editor for layered 2D scenes, hotspots, pickups, actors, player
  setup, assets, prompt packs, and validation.
- Web player and embedded packaged preview.
- Git-friendly JSON project format with schema and semantic validation.
- Public sample game, minimal starter project, and authoring docs.
- Local-first AI workflows with mock prompt generation, LM Studio, experimental
  opt-in cloud providers, and ComfyUI image import.
- Mock deterministic is the guaranteed offline path and requires no provider
  account, key, model download, or network request.
- Local deterministic narrative and puzzle suggestions that stay advisory;
  creators author the resulting Flow JSON and gameplay logic explicitly.
- AI workflow documents for style bibles, workflow templates, generation
  recipes, and generated asset provenance.
- ComfyUI preset install for SDXL standard 8GB background T2I, SDXL
  Lightning/Turbo fast-draft background T2I, SDXL Lightning/Turbo 8GB
  prop/character chroma, and SD 1.5 8GB masked inpaint, with recipe-first
  generation and legacy workflow path fallback.
- ComfyUI template binding patching for prompt, negative prompt, seed,
  dimensions, checkpoint, output prefix, reference images, mask images, and
  explicit output nodes.
- Generated image asset provenance for workflow id, recipe id, workflow family,
  prompt pack target, linked reference and mask assets, parent asset lineage,
  dimensions, warnings, model, and seed.
- Inspector asset import/drop, pickup image assets, and chroma cleanup for flat
  blue/green backgrounds.
- Project, Scenes, Narrative, AI Studio, Assets, and Build now share direct
  navigation: summaries, scene selections, narrative triggers, AI targets, and
  build diagnostics open the relevant object instead of acting as passive lists.

## Known Limitations

- Windows is the primary packaged target.
- The Windows x64 package is unsigned; no signing certificate or signing
  evidence is configured for this Alpha.
- Character Gym is an MVP editor workflow for spritesheet slicing, clip preview,
  pack editing, and player/actor assignment. Generated animation-sheet
  consistency still needs stronger presets.
- Transparent PNG quality depends on the selected ComfyUI workflow or a clean
  flat chroma source for editor cleanup.
- Reference and mask inputs require an installed ComfyUI template or legacy API
  workflow with compatible image loader nodes; plain text-to-image paths do not
  use image inputs.
- Flow graph editing, hosted demo, marketing site, web export, and npm SDK
  publishing are outside this release.
- AI provider keys are optional; OpenAI requires API platform access and is not
  covered by a ChatGPT subscription.
- Cloud providers are experimental and opt-in. Creator Alpha remains useful
  without an account, key, or paid provider.

## Release Gate

Before tagging, run:

```powershell
pnpm check
pnpm audit --audit-level high
pnpm test:e2e
pnpm check:release:candidate
pnpm validate:provenance:strict
pnpm verify:windows-package
```

Also complete the manual smoke test in `docs/release-checklist.md`.
