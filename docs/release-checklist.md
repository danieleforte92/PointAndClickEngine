# Creator Alpha Release Checklist

Use this checklist before tagging a public GitHub release.

## Clean Checkout

```powershell
git status --short
pnpm install --frozen-lockfile
pnpm check
```

Expected result:

- no unintended project files, generated assets, workflow exports, logs, or test
  artifacts in `git status`;
- `starter-game` validates as a minimal project;
- `sample-game` validates as the public demo.

Notes:

- `pnpm check` packages the Electron editor. On a restricted sandbox it may fail
  during Electron Forge packaging when runtime artifacts must be fetched over
  HTTPS. Re-run in a shell with network access before treating the release gate
  as failed.
- Root-level experimental workflow JSON files, `.zip` archives, logs,
  `node_modules`, `.vite`, `dist`, and packaged `out` directories must stay
  untracked. Project-local workflow templates are allowed only when they are
  intentional sample or documentation fixtures.

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
13. With ComfyUI running, generate and import one image asset.
14. Send a `sprite-sheet` or `animation-reference` target to Asset Studio and verify Character Gym can slice it.
15. In **Build**, run validation.
16. Use **Play from here** and **Browser** preview.

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

## Public Release Notes

Include:

- current status: Creator Alpha;
- quick start commands;
- sample game loop;
- local AI provider notes;
- AI Workflow Engine status: mock prompt packs are stable, ComfyUI text-to-image
  import is available, and recipe/registry/img2img/inpaint work is roadmap scope
  unless completed before tagging;
- known limitations;
- screenshot or GIF from `docs/assets`;
- links to README, roadmap, authoring tutorial, AI guide, and Character Gym guide.

## Known Limitations To State Publicly

- Character Gym is available in Asset Studio; generated animation sheets still
  need stronger consistency presets before they are production-grade.
- Transparent PNG output depends on the selected ComfyUI workflow or a clean
  flat chroma source for editor cleanup.
- OpenAI integration requires API platform access; ChatGPT subscriptions do not
  cover API calls.
- Flow graph editing, hosted demo, and public website are later milestones.
