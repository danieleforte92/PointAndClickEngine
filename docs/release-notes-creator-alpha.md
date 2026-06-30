# Creator Alpha Release Notes

Creator Alpha is the first public open-source release target for Point & Click
Engine. It is a technical alpha for contributors and early creators who are
comfortable with local developer tools.

## What To Try First

1. Run `pnpm install --force` and `pnpm dev`.
2. Open `apps/sample-game/project`.
3. Move a scene hotspot, pickup, player start, or walk-area point.
4. Generate a mock prompt pack in **AI**.
5. Import or drop an image asset in an inspector.
6. Use **Remove Background** on a flat blue/green chroma image and save the
   result as a new PNG asset.
7. Run validation in **Build**, then preview with **Play from here** and
   **Browser**.

## Included

- Electron editor for layered 2D scenes, hotspots, pickups, actors, player
  setup, assets, prompt packs, and validation.
- Web player and embedded packaged preview.
- Git-friendly JSON project format with schema and semantic validation.
- Public sample game, minimal starter project, and authoring docs.
- Local-first AI workflows with mock prompt generation, LM Studio, OpenAI API,
  and ComfyUI image import.
- AI workflow documents for style bibles, workflow templates, generation
  recipes, and generated asset provenance.
- ComfyUI custom workflow patching for prompt, negative prompt, seed,
  dimensions, checkpoint, output prefix, reference images, and mask images.
- Generated image asset provenance for workflow family, prompt pack target,
  linked reference and mask assets, parent asset lineage, dimensions, warnings,
  model, and seed.
- Inspector asset import/drop, pickup image assets, and chroma cleanup for flat
  blue/green backgrounds.

## Known Limitations

- Windows is the primary packaged target.
- Character Gym runtime and document support exist, but the full sprite editor
  UX is still being completed.
- Transparent PNG quality depends on the selected ComfyUI workflow or a clean
  flat chroma source for editor cleanup.
- Reference and mask inputs require a custom ComfyUI API workflow with
  compatible image loader nodes; the built-in text-to-image path does not use
  image inputs.
- Flow graph editing, hosted demo, marketing site, web export, and npm SDK
  publishing are outside this release.
- AI provider keys are optional; OpenAI requires API platform access and is not
  covered by a ChatGPT subscription.

## Release Gate

Before tagging, run:

```powershell
pnpm check
pnpm test:e2e
pnpm validate:sample
pnpm validate:starter
```

Also complete the manual smoke test in `docs/release-checklist.md`.
