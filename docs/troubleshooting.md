# Troubleshooting

## Install

Use the pinned package manager:

```powershell
corepack enable
pnpm install --frozen-lockfile
```

If local dependencies drift while developing, refresh with:

```powershell
pnpm install --force
```

## Editor Opens Without A Project

Use one of the first-run actions:

- **New From Starter** for a minimal editable project;
- **Blank Project** for the smallest valid project;
- **Open Project** and choose a folder containing `adventure.project.json`.

## Validation Fails

Run the focused validators:

```powershell
pnpm validate:starter
pnpm validate:sample
```

Common causes:

- scene background references an unregistered asset path;
- actor, player, or animation pack references a missing asset ID;
- flow transition points to a deleted scene;
- locale keys referenced by scene entities are missing.

## LM Studio Does Not Generate

- Start the LM Studio local server.
- Use base URL `http://localhost:1234/v1`.
- Use the model ID shown by LM Studio.
- Leave API key empty or use any local bearer value.
- If `/v1/responses` is unavailable, the editor falls back to
  `/v1/chat/completions`.

Keep LM Studio bound to localhost unless you have authentication and firewalling
in place.

## ComfyUI Does Not Queue

- Start ComfyUI and confirm `http://127.0.0.1:8188` opens.
- Export the workflow in **API** format.
- Put the workflow JSON path in **Workflow API JSON path**.
- Leave checkpoint override empty for workflows that already load their own
  model, especially Krea/Qwen-style exports.
- Watch the editor's **ComfyUI status** card and the ComfyUI queue/history.

The editor uses `POST /prompt`, polls `/history/{prompt_id}`, downloads through
`/view`, saves under `assets/imported`, and registers a normal project asset.

## Transparent PNGs Are Not Transparent

Prompting alone is not enough. The workflow must preserve alpha or remove a
chroma background before `SaveImage`.

Use a ComfyUI workflow for one of these paths:

- generate directly with alpha if the model/workflow supports it;
- generate on flat blue/green chroma and remove the background in ComfyUI;
- import the chroma image as a reference and clean it in an external tool.

If the workflow saves an RGB PNG, the editor will still import it, but it is not
ready as a transparent prop or character asset.

## Packaged Preview

Run:

```powershell
pnpm build
```

Then open:

```text
apps/editor/out/PointClickStudio-win32-x64/
```

Packaged preview serves the embedded player from a loopback server and should
not require the Vite dev server.
