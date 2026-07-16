# Creator Alpha v0.5.0-alpha Release Checklist

The current workspace candidate is `v0.5.0-alpha`, covering the M01–M09 Visual
Authoring roadmap. Verify the integrated commit with the complete test,
typecheck, build, Playwright, accessibility, screenshot, Windows package, and
packaged player smoke gates before tagging.

## Previous Candidate Checklist

Use this checklist before tagging a public GitHub release.

The target tag is `v0.4.0-alpha.3`. The Windows x64 package is intentionally unsigned;
do not record signing as passed unless a separate authorized signing decision
and evidence exist.

For the GitHub tracking issue body, use
`docs/creator-alpha-release-issue.md`.

## Clean Checkout

```powershell
git status --short
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm audit --audit-level high
pnpm check:release:candidate
pnpm test:e2e
pnpm validate:provenance:strict
pnpm verify:windows-package
pnpm --filter @pointclick/editor make
pnpm test:e2e:packaged
```

Expected result:

- no unintended project files, generated assets, workflow exports, logs, or test
  artifacts in `git status`;
- `starter-game` validates as a minimal gameplay project with only curated
  workflow preset fixtures;
- `sample-game` validates as the public demo.
- release evidence identifies the exact commit, Node.js 22.17.0, pnpm 9.6.0,
  clean-status result, SHA-256 checksum file, signing status, packaged-preview
  result, and strict provenance outcome.

Notes:

- `pnpm check` packages the Electron editor. On a restricted sandbox it may fail
  during Electron Forge packaging when runtime artifacts must be fetched over
  HTTPS. Re-run in a shell with network access before treating the release gate
  as failed.
- Root-level experimental workflow JSON files, `.zip` archives, logs,
  `node_modules`, `.vite`, `dist`, and packaged `out` directories must stay
  untracked. Project-local workflow templates are allowed only when they are
  intentional sample or documentation fixtures.
- A strict provenance failure is a release blocker, even though the ordinary
  `pnpm check` deliberately permits review-required starter/sample assets. Do
  not mark an item approved without its source, permitted redistribution basis,
  and evidence recorded in `provenance/inventory.json`.
- `pnpm audit --audit-level high` covers runtime and packaging dependencies; a
  high or critical finding is a release blocker.
- `pnpm check:release:candidate` verifies that the committed checkout is clean,
  that every required release control is tracked, and that all workspace package
  metadata uses the release version while remaining private. Run it after the
  build; ignored package output does not invalidate the clean-source check.

## CI and Automation Controls

Review the GitHub Actions run for the exact candidate commit before recording a
release decision. The required stabilization controls are:

- Windows quality runs unit tests, threshold-enforced coverage, typecheck,
  fixture validation, release hygiene, package verification, and packaged smoke.
- Ubuntu quality runs the same unit-test and coverage gate, typecheck, fixture
  validation, and the web-player build.
- The browser smoke job and packaged smoke job retain their Playwright/CDP
  diagnostics when they fail; review those artifacts instead of dismissing a
  failed check as an environment-only issue.
- CodeQL is green for the candidate commit, and the dependency-security job
  passes the high-severity audit.
- Dependabot is enabled for both npm dependencies and GitHub Actions on a
  weekly schedule.
- Every `uses:` entry under `.github/workflows/` points to a full 40-character
  commit SHA. The repository-controls CI job enforces this rule for future
  changes.

## Manual Smoke Test

1. Start the editor:

   ```powershell
   pnpm dev
   ```

2. Create a blank project.
3. Create a project from starter.
4. Open `apps/sample-game/project`.
5. In **Scene**, move a hotspot, pickup, player start, and walk-area point.
6. In **Scene > Player**, change player asset or animation pack settings, then preview.
7. In **Scene**, add an image layer, change depth/opacity/visibility, save, and preview.
8. In **Asset Studio**, import an image and assign it as a scene background.
9. Drop or import an image from a Scene, Player, Actor, or Pickup inspector and
   verify the new asset is assigned to that draft.
10. Run **Asset Studio > Chroma Key** on a flat chroma image, save the processed PNG, and
   verify it is assigned as a new asset without overwriting the source.
11. In **AI**, generate a mock prompt pack.
12. In **AI Studio**, open Advanced from Generate and Review; confirm it scrolls
    into view, Candidate Output is reachable, keyboard focus is visible, and
    mouse-wheel/touchpad scrolling moves the central panel.
13. With LM Studio running, generate a local prompt pack.
14. With ComfyUI running, install the background preset, save a recipe, generate
    a candidate batch, and explicitly apply one text-to-image asset.
15. Install the chroma or inpaint preset, queue one target with linked reference
    or mask assets when available, and confirm provenance records `workflowId`,
    `recipeId`, `referenceAssetIds`, `maskAssetId`, and `parentAssetIds`.
16. Send a `sprite-sheet` or `animation-reference` target to Asset Studio and verify Character Gym can slice it.
17. In **Build**, run validation.
18. Use **Play** to enter Test Lab, open **Browser**, refresh telemetry, and
    confirm the Compare tab reports no logical-state divergence.

## v0.4 Alpha Smoke

In addition to the editor smoke above, record these distribution and runtime
checks for the v0.4 alpha candidate:

1. Run migration dry-run, backup, and rollback against a v1 fixture.
2. Create and restore a manual save, autosave, and checkpoint in the sample.
3. Validate browser storage and Electron storage adapters.
4. Inspect Flow graph diagnostics and puzzle dependency output.
5. Export the sample to a static web build and open the output without the
   development server.
6. Verify keyboard focus, captions, reduced motion, contrast-oriented controls,
   and the 390px-wide player layout.
7. Run `pnpm --filter @pointclick/editor make` and verify the portable ZIP,
   Squirrel `RELEASES`, `Setup.exe`, and full `.nupkg` output.

For provider smoke tests:

- Keep LM Studio and ComfyUI bound to localhost.
- Do not commit model weights, generated experiments, provider secrets, or
  machine-local absolute paths.
- Confirm imported AI images are normal project assets and that any available
  provider provenance remains visible from the editor.

The checked-in public screenshots are deterministic mock captures. They must not
show provider keys, provider output, machine-local absolute paths, or model
weights.

## Package

```powershell
pnpm build
```

Run the package step from a clean checkout or CI runner. Do not use a
pre-existing ignored `apps/editor/out` directory as evidence for a new
candidate.

The Windows editor should be available at:

```text
apps/editor/out/PointClickStudio-win32-x64/
```

Open the packaged editor and confirm preview still works without the Vite player
server.

Generate the candidate evidence after the package exists:

```powershell
node scripts/create-checksums.mjs apps/editor/out release-artifacts/SHA256SUMS.txt release-artifacts/PointClickStudio-v0.4.0-alpha.3-win32-x64.zip
node scripts/release-record.mjs --output release-artifacts/release-evidence.json --checksums release-artifacts/SHA256SUMS.txt
```

Record the human decisions in the evidence environment variables only after they
occur: `RELEASE_PACKAGED_PREVIEW=passed` with a concise evidence note, and a
real `RELEASE_SIGNING_STATUS` if signing has been authorized. `pending` and
`not-configured` are accurate Creator Alpha statuses; do not fabricate signing.

## Accessibility and Reliability Smoke

This bounded Alpha check is not a WCAG conformance claim. In the browser player
and packaged editor preview, verify:

1. Keyboard focus reaches the primary verb, inventory, guide/capture controls,
   and visible dialogs without trapping focus.
2. At a 390px-wide viewport, the player has no horizontal overflow and the
   canvas, verbs, and inventory remain usable.
3. With the sample project, complete the look, pickup, use, and walk loop,
   then reopen preview after saving a scene edit.
4. Run the automated browser smoke with `pnpm test:e2e`; investigate a failure
   rather than treating it as an accessibility sign-off.

Full accessibility audit, SBOM generation, and code signing are post-Alpha
release work unless a maintainer explicitly adds them to the candidate scope.

## Public Release Notes

Include:

- current status: Creator Alpha;
- quick start commands;
- sample game loop;
- local AI provider notes;
- AI Workflow Engine status: mock prompt packs are stable; workflow template,
  generation recipe, style bible, generated provenance, ComfyUI text-to-image,
  and custom reference/mask upload paths are available; advanced recipe approval
  and richer job progress remain later polish;
- known limitations;
- screenshot or GIF from `docs/assets`;
- `docs/assets/scene_editor.jpg`, `docs/assets/player.jpg`,
  `docs/assets/ai-studio-advanced.png`, and `docs/assets/asset_studio.jpg`
  reviewed for public-safe content;
- links to README, roadmap, authoring tutorial, AI guide, and Character Gym guide.

## Known Limitations To State Publicly

- Character Gym is available in Asset Studio; generated animation sheets still
  need stronger consistency presets before they are production-grade.
- Transparent PNG output depends on the selected ComfyUI workflow or a clean
  flat chroma source for editor cleanup.
- Reference and mask inputs require a custom ComfyUI API workflow with compatible
  image loader nodes; the built-in text-to-image path ignores image inputs.
- OpenAI integration requires API platform access; ChatGPT subscriptions do not
  cover API calls.
- The Windows x64 package is unsigned in Creator Alpha v0.4.0-alpha.3.
- Custom flow-node plugins, hosted demo, and public website are later
  milestones; the built-in typed graph and static web export are included in
  this candidate.
