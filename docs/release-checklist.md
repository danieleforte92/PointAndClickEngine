# Creator Alpha Release Checklist

Use this checklist before tagging a public GitHub release.

For the GitHub tracking issue body, use
`docs/creator-alpha-release-issue.md`.

## Clean Checkout

```powershell
git status --short
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm check:release:candidate
pnpm test:e2e
pnpm validate:provenance:strict
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
- `pnpm check:release:candidate` verifies that the committed checkout is clean,
  that every required release control is tracked, and that all workspace package
  metadata uses the release version while remaining private. Run it after the
  build; ignored package output does not invalidate the clean-source check.

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
12. With LM Studio running, generate a local prompt pack.
13. With ComfyUI running, install the background preset, save a recipe, then
    generate and import one text-to-image asset.
14. Install the chroma or inpaint preset, queue one target with linked reference
    or mask assets when available, and confirm provenance records `workflowId`,
    `recipeId`, `referenceAssetIds`, `maskAssetId`, and `parentAssetIds`.
15. Send a `sprite-sheet` or `animation-reference` target to Asset Studio and verify Character Gym can slice it.
16. In **Build**, run validation.
17. Use **Play from here** and **Browser** preview.

For provider smoke tests:

- Keep LM Studio and ComfyUI bound to localhost.
- Do not commit model weights, generated experiments, provider secrets, or
  machine-local absolute paths.
- Confirm imported AI images are normal project assets and that any available
  provider provenance remains visible from the editor.

## Package

```powershell
pnpm build
```

The Windows editor should be available at:

```text
apps/editor/out/PointClickStudio-win32-x64/
```

Open the packaged editor and confirm preview still works without the Vite player
server.

Generate the candidate evidence after the package exists:

```powershell
node scripts/create-checksums.mjs apps/editor/out release-artifacts/SHA256SUMS.txt
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
- Flow graph editing, hosted demo, and public website are later milestones.
