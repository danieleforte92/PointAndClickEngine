# Creator Alpha Release Tracking Issue

Use this as the body for the GitHub tracking issue before tagging `v0.1.0`.

## Goal

Ship the first public Windows-first technical alpha of Point & Click Engine: a
local-first, Git-friendly 2D point-and-click editor/runtime that a technical
creator can clone, run, inspect, modify, validate, and package without paid
provider keys. The 0.1.x line keeps schema-v1 compatibility; generic web
export, SDK publishing, and a full puzzle-AI promise are out of scope.

## Exit Criteria

- `pnpm install --frozen-lockfile` succeeds from a clean checkout.
- `pnpm check` passes with network access available for Electron Forge
  packaging.
- `pnpm audit --audit-level high` passes for runtime and packaging dependencies.
- `pnpm test:e2e` passes or any failure is explicitly documented before
  tagging.
- `pnpm validate:provenance:strict` passes after a human records actual asset,
  workflow, and third-party redistribution decisions.
- Candidate evidence records the exact commit, Node.js 22.17.0, pnpm 9.6.0,
  clean status, SHA-256 checksums, signing status, and packaged-preview result.
- `apps/starter-game/project` validates as the minimal clean gameplay project
  with curated ComfyUI workflow preset fixtures.
- `apps/sample-game/project` validates as the public demo project.
- The packaged Windows editor opens and previews the sample without the Vite dev
  server.
- README, roadmap, release notes, troubleshooting, AI guide, Character Gym guide,
  and project format docs match the shipped behavior.
- The release includes a current screenshot or GIF from `docs/assets`.
- The release includes the deterministic Player, AI Studio, and Asset Studio
  screenshots from `docs/assets`.
- No model weights, generated experiments, provider secrets, local absolute
  paths, caches, logs, or packaged output are committed.

## Manual Smoke Test

Follow `docs/release-checklist.md`.

Record the result here before tagging:

No manual smoke item below is claimed complete by this draft. Check an item only
after recording the real result in release evidence or the maintainer's manual
smoke notes.

- [ ] Blank project created.
- [ ] Starter project created and validated.
- [ ] Sample project opened.
- [ ] Scene edit saved and previewed.
- [ ] Player asset or animation pack setting changed and previewed.
- [ ] Asset imported or dropped from an inspector.
- [ ] Chroma cleanup saved as a processed PNG asset.
- [ ] Mock prompt pack generated.
- [ ] AI Studio Advanced scroll, Candidate Output, keyboard focus, and wheel/touchpad smoke completed.
- [ ] LM Studio prompt pack generated, if LM Studio is installed.
- [ ] ComfyUI preset installed, recipe saved, and text-to-image asset generated,
      if ComfyUI is installed.
- [ ] ComfyUI chroma or inpaint workflow smoke-tested, if a compatible target is
  available.
- [ ] Character Gym can preview a spritesheet target.
- [ ] Build validation run from the editor.
- [ ] Browser preview opened.
- [ ] Packaged editor preview opened.
- [ ] Keyboard, narrow-viewport, and preview-reopen reliability smoke completed.
- [ ] Strict provenance gate passed with evidence; no review-required release input remains.
- [ ] Candidate checksum and release-evidence artifacts reviewed.

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
- Cloud providers are experimental and opt-in; no provider account is required
  for the local-first authoring loop.

## Release Artifacts

- Source archive from GitHub release.
- Windows packaged editor from `apps/editor/out/PointClickStudio-win32-x64/`.
- Screenshot or GIF from `docs/assets`.
- `docs/assets/player-showcase-loop.png` — completed Player loop.
- `docs/assets/ai-studio-advanced.png` — mock Advanced workspace with Candidate Output.
- `docs/assets/asset-studio.png` — mock Asset Studio surface.
- Link to `docs/release-notes-creator-alpha.md`.
- Link to `docs/release-checklist.md`.
- SHA-256 checksum file and release-evidence JSON from the release-candidate
  workflow. Candidate artifacts are unsigned unless a separate authorized
  signing decision says otherwise.

## Risks

- **Packaging fetch failure**: Electron Forge may need HTTPS access. Re-run
  `pnpm check` outside restricted sandboxes before blocking the release.
- **Dependency advisories**: high or critical findings in runtime or packaging
  dependencies block the candidate; update the lockfile and rerun the full
  audit instead of suppressing the finding.
- **Provider confusion**: local AI tools are optional. Keep mock provider paths
  working and call out that models/weights are user-installed.
- **Workflow mismatch**: custom ComfyUI exports vary. State that only installed
  templates or compatible API workflows with expected loader nodes can use
  reference/mask inputs.
- **Stale demo asset**: refresh or explicitly accept the checked-in screenshot
  before tagging.
