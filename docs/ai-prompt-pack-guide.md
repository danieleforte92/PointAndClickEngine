# AI Prompt Pack Guide

Prompt packs are authoring artifacts for art direction. They are not required at
runtime. Creator Alpha remains usable without paid provider keys. The editor can
optionally call OpenAI, LM Studio, or ComfyUI when the user configures a provider.

## What A Prompt Pack Contains

- Scene context extracted from project documents.
- An art brief.
- Background, prop, character, and animation prompts.
- Negative prompt and style notes.
- Generation targets.
- Provenance with provider, model, generation time, and optional input hash.

The sample prompt pack lives at:

```text
apps/sample-game/project/prompt-packs/moonlit-dock-art.prompt-pack.json
```

## Editor Workflow

Open the **AI** workspace in the editor.

1. Choose a layered 2D scene.
2. Write or revise the art brief.
3. Choose a provider:
   - **Mock deterministic** works offline and is the default open-source path.
   - **OpenAI Responses API** uses an OpenAI API platform key or the
     `OPENAI_API_KEY` environment variable.
   - **LM Studio local** uses a local OpenAI-compatible server, typically
     `http://localhost:1234/v1`.
4. Generate a candidate prompt pack.
5. Review background, prop, character, animation, target, actor, and provenance
   sections.
6. Save only when the candidate is approved.

Generation does not mutate project files. The editor writes a prompt-pack JSON
document only after **Save Approved Pack**.

The AI workspace includes composable presets for visual style, mood, setting,
palette, gameplay emphasis, output target, and negative prompt guidance. The
default Creator Alpha direction is original-IP comic adventure art with strong
negative guidance against photorealism, logos, readable text, watermarks, and
existing franchise characters.

Preset blocks and custom answers are folded into the saved art brief so local
and cloud providers receive the same structured context.

## Local Prompt Drafting With LM Studio

1. Start LM Studio and enable the local server.
2. Load a text model.
3. In the editor AI workspace, choose **LM Studio local**.
4. Set the base URL to `http://localhost:1234/v1`.
5. Enter the model id shown by LM Studio.
6. Generate the prompt pack.

The editor first tries the OpenAI-compatible `/responses` endpoint and falls
back to `/chat/completions` when the local server does not expose Responses.
The API key field is optional; LM Studio commonly accepts any bearer value.

## Local Image Generation With ComfyUI

ComfyUI is used after a prompt pack exists. The editor can generate one target at
a time and import the resulting PNG into the project asset library.

1. Start ComfyUI locally.
2. In the editor AI workspace, use **ComfyUI Image Generation**.
3. Set the base URL to `http://127.0.0.1:8188`.
4. Enter the exact checkpoint filename visible in ComfyUI, including extension,
   or provide a project-relative ComfyUI workflow API JSON path.
5. Choose an output preset and generation target from the active prompt pack.
6. Optionally set a seed.
7. Set a timeout long enough for the workflow. Krea/Qwen workflows can take many
   minutes on 8GB GPUs.
8. Click **Generate And Import Asset**.

The editor queues a small text-to-image workflow through `POST /prompt`, polls
`GET /history/{prompt_id}`, downloads the generated image through `/view`, saves
it under `assets/imported`, and registers a normal image asset document.

### Custom ComfyUI API Workflows

The **Workflow API JSON path** field accepts a path relative to the loaded
project directory. For example, if the loaded project is
`apps/starter-game/project`, copy the workflow to
`apps/starter-game/project/workflows/image_krea2_turbo_t2i.json` and enter
`workflows/image_krea2_turbo_t2i.json`.

Absolute paths and paths outside the loaded project are rejected in Creator
Alpha to prevent project-file path traversal. Root-level experimental workflow
JSON files are ignored by release checks and are not searched automatically.

When a custom workflow is provided, the editor patches:

- `CheckpointLoaderSimple.inputs.ckpt_name` when a checkpoint override is set;
- `EmptyLatentImage.inputs.width` and `height`;
- every numeric `inputs.seed`;
- `SaveImage.inputs.filename_prefix`;
- existing `CLIPTextEncode.inputs.text` prompt nodes.

If the workflow has no `CLIPTextEncode` nodes but has `CheckpointLoaderSimple`
and standard `KSampler` nodes, the provider injects positive and negative prompt
nodes and wires them into the sampler. This supports small API exports such as
SDXL Turbo workflows that were saved without prompt text nodes.

Krea/Qwen-style workflows are also supported. For exports that route the prompt
through `PrimitiveStringMultiline`, `TextGenerate`, `ComfySwitchNode`, and linked
`CLIPTextEncode` nodes, the provider patches the node titled like **User Prompt**
instead of rewiring the graph. Leave checkpoint override empty unless you want to
replace the workflow's model names.

When the request is accepted, the editor status card should report that the job
was queued. The ComfyUI web UI should then show an active or completed job in
its queue/history. If no job appears, check the workflow path and the status
message in the editor before changing ComfyUI itself.

### Transparent And Chroma Asset Workflows

Creator Alpha prioritizes workflow-based transparency. The editor labels the
selected target as opaque, alpha-workflow, or chroma-workflow before queueing a
job. It can request a transparent or chroma target, but the final alpha channel
depends on the exported ComfyUI workflow.

Recommended workflow families:

- **Room background**: opaque 16:9 background, no characters, no UI, no readable
  text, clear walkable lower half.
- **Prop sheet chroma**: isolated props on a flat blue or green chroma
  background, clean margins, no overlapping objects.
- **Character full body chroma**: full-body character, neutral pose, cropped
  neither head nor feet, flat chroma background.
- **Background removal / alpha output**: generate on chroma, remove the chroma
  background inside ComfyUI, and save a PNG with alpha.

If a workflow saves an RGB PNG without alpha, the imported asset is still valid,
but it is not a transparent-ready prop or character. Use the prompt preview and
workflow name to make this limitation visible before relying on the asset for
runtime composition.

The editor imports ComfyUI output as-is in this release slice. Local chroma-key
post-processing is intentionally left as a later option for workflows that
produce clean flat-color backgrounds but do not save alpha.

Keep ComfyUI and LM Studio bound to localhost for this workflow. Do not expose
either local server to a public network without authentication and firewalling.

## Provider Boundary

Providers return a complete candidate `PromptPackDocument` and never mutate
project files directly. The Electron main process owns configured provider calls
so API keys are not sent from the renderer to arbitrary browser fetches.

Provider integrations must document:

- required environment variables;
- request and response shape;
- cost and rate-limit behavior;
- provenance fields;
- failure behavior.

ChatGPT Plus, Pro, Business, and Codex subscriptions are separate from OpenAI API
platform billing. Testing the OpenAI provider requires API platform access, not
only a ChatGPT subscription. LM Studio and ComfyUI run locally and do not require
OpenAI billing.

## Release Rule

The open-source release must remain useful without provider keys. Sample prompt
packs should validate from checked-in JSON and should never depend on external
network calls. Tests must mock provider calls instead of hitting paid APIs.
