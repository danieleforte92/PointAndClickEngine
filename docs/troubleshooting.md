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
- Install a compatible workflow preset in AI Studio, or export a workflow
  in **API** format and use **Workflow API JSON path (legacy/advanced)**.
- Save a generation recipe before queueing when you want provenance to include
  `workflowId` and `recipeId`.
- For the 8GB presets, place `sdxl_lightning_4step.safetensors` or an SD 1.5
  inpainting checkpoint in `ComfyUI/models/checkpoints`, then select it in
  **Checkpoint filename / override** if your local filename differs.
- Leave checkpoint override empty for workflows that already load their own
  model, especially Krea/Qwen-style exports.
- Watch the editor's **ComfyUI status** card and the ComfyUI queue/history.

The editor uses `POST /prompt`, polls `/history/{prompt_id}`, downloads through
`/view`, saves under `assets/imported`, and registers a normal project asset.

## Workflow Path Is Rejected

Workflow paths must be relative to the loaded project directory.

Use:

```text
workflows/my-background-api.json
```

Do not use:

```text
C:\Users\you\Downloads\workflow.json
..\workflow.json
```

Creator Alpha rejects absolute paths and parent-directory traversal so project
files cannot silently depend on machine-local locations outside the project.

## Reference Or Mask Inputs Are Ignored

Reference and mask assets only affect installed templates or legacy workflows
that expose image loader nodes. Check the selected target and workflow:

- the target should show **Reference workflow expected** or
  **Inpaint workflow expected** in AI Studio;
- an installed compatible workflow template should be selected, or **Workflow API
  JSON path (legacy/advanced)** must be set before queueing reference or mask
  targets;
- the exported ComfyUI workflow should contain `LoadImage`, `LoadImageMask`, or
  mask-like `LoadImage` nodes;
- after queueing, generated asset provenance should include `workflowId`,
  `recipeId`, `referenceAssetIds`, `maskAssetId`, and `parentAssetIds` where
  applicable.

If the editor reports that image inputs require a custom workflow, the built-in
text-to-image path would ignore those files. Export or select an img2img/inpaint
workflow first.

## ComfyUI Times Out Or Runs Out Of VRAM

- Use **Background Draft 16:9** (`1024x576`) or **Background Draft Plus 16:9**
  (`1152x648`) for iteration.
- For usable scene backgrounds, prefer **Background 16:9 SDXL Standard 8GB**.
  Lightning/Turbo presets are fast draft paths; repeated character sheets,
  colored noise, or abstract patterns usually mean the distilled checkpoint is
  not suitable for that target.
- Avoid latent 2048x2048 upscales in the default local workflow.
- Increase **Timeout minutes** for Krea/Qwen-style workflows.
- Leave checkpoint override empty when the workflow already loads its models.
- Close other GPU-heavy applications and retry before changing prompts.

For RTX 3070 8GB-class hardware, use direct 16:9 draft or preview dimensions
first, then clean up selected regions with inpaint or chroma/alpha processing.

## Transparent PNGs Are Not Transparent

Prompting alone is not enough. The workflow must preserve alpha or remove a
chroma background before `SaveImage`.

Use a ComfyUI workflow for one of these paths:

- generate directly with alpha if the model/workflow supports it;
- generate on flat blue/green chroma and remove the background in ComfyUI;
- import the chroma image, open **Remove Background** in the editor inspector,
  preview the chroma cleanup, then save it as a new PNG asset.

If the workflow saves an RGB PNG, the editor will still import it, but it is not
ready as a transparent prop or character asset until you run chroma cleanup or
replace it with an alpha-capable workflow output.

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
