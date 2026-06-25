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

## Manual Smoke Test

1. Start the editor:

   ```powershell
   pnpm dev
   ```

2. Create a blank project.
3. Create a project from starter.
4. Open `apps/sample-game/project`.
5. In **Scene**, move a hotspot, pickup, player start, and walk-area point.
6. In **Player**, change player asset or animation pack settings, then preview.
7. In **Assets**, import an image and assign it as a scene background.
8. In **AI**, generate a mock prompt pack.
9. With LM Studio running, generate a local prompt pack.
10. With ComfyUI running, generate and import one image asset.
11. In **Build**, run validation.
12. Use **Play from here** and **Browser** preview.

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
- known limitations;
- screenshot or GIF from `docs/assets`;
- links to README, roadmap, authoring tutorial, AI guide, and Character Gym guide.

## Known Limitations To State Publicly

- Character Gym runtime support exists, but the full sprite editor UX is still
  being completed.
- Transparent PNG output depends on the selected ComfyUI workflow.
- OpenAI integration requires API platform access; ChatGPT subscriptions do not
  cover API calls.
- Flow graph editing, hosted demo, and public website are later milestones.
