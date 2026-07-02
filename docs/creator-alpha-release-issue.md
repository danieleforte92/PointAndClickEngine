# Creator Alpha Release Tracking Issue

Use this as the body for the GitHub tracking issue before tagging
`creator-alpha`.

## Goal

Ship the first public technical alpha of Point & Click Engine: a local-first,
Git-friendly 2D point-and-click editor/runtime that a technical creator can
clone, run, inspect, modify, validate, and package without paid provider keys.

## Exit Criteria

- `pnpm install --frozen-lockfile` succeeds from a clean checkout.
- `pnpm check` passes with network access available for Electron Forge
  packaging.
- `pnpm test:e2e` passes or any failure is explicitly documented before
  tagging.
- `apps/starter-game/project` validates as the minimal clean gameplay project
  with curated ComfyUI workflow preset fixtures.
- `apps/sample-game/project` validates as the public demo project.
- The packaged Windows editor opens and previews the sample without the Vite dev
  server.
- README, roadmap, release notes, troubleshooting, AI guide, Character Gym guide,
  and project format docs match the shipped behavior.
- The release includes a current screenshot or GIF from `docs/assets`.
- No model weights, generated experiments, provider secrets, local absolute
  paths, caches, logs, or packaged output are committed.

## Manual Smoke Test

Follow `docs/release-checklist.md`.

Record the result here before tagging:

- [ ] Blank project created.
- [ ] Starter project created and validated.
- [ ] Sample project opened.
- [ ] Scene edit saved and previewed.
- [ ] Player asset or animation pack setting changed and previewed.
- [ ] Asset imported or dropped from an inspector.
- [ ] Chroma cleanup saved as a processed PNG asset.
- [ ] Mock prompt pack generated.
- [ ] LM Studio prompt pack generated, if LM Studio is installed.
- [ ] ComfyUI preset installed, recipe saved, and text-to-image asset generated,
  if ComfyUI is installed.
- [ ] ComfyUI chroma or inpaint workflow smoke-tested, if a compatible target is
  available.
- [ ] Character Gym can preview a spritesheet target.
- [ ] Build validation run from the editor.
- [ ] Browser preview opened.
- [ ] Packaged editor preview opened.

## Known Limitations To Mention

- Windows is the primary packaged target.
- Character Gym can preview and edit packs, but generated sprite-sheet
  consistency still needs stronger presets.
- Flow graph editing is not a full node-graph editor yet.
- Transparent PNG quality depends on the selected ComfyUI workflow or clean
  chroma cleanup.
- Reference and mask image inputs require a compatible installed ComfyUI
  template or legacy API workflow; plain text-to-image paths do not consume image
  inputs.
- OpenAI support requires API platform billing; ChatGPT subscriptions do not
  cover API calls.
- Hosted demo, public website, web export, and SDK publishing are later
  milestones.

## Release Artifacts

- Source archive from GitHub release.
- Windows packaged editor from `apps/editor/out/PointClickStudio-win32-x64/`.
- Screenshot or GIF from `docs/assets`.
- Link to `docs/release-notes-creator-alpha.md`.
- Link to `docs/release-checklist.md`.

## Risks

- **Packaging fetch failure**: Electron Forge may need HTTPS access. Re-run
  `pnpm check` outside restricted sandboxes before blocking the release.
- **Provider confusion**: local AI tools are optional. Keep mock provider paths
  working and call out that models/weights are user-installed.
- **Workflow mismatch**: custom ComfyUI exports vary. State that only installed
  templates or compatible API workflows with expected loader nodes can use
  reference/mask inputs.
- **Stale demo asset**: refresh or explicitly accept the checked-in screenshot
  before tagging.
