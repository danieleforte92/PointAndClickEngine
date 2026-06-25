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

The AI workspace also includes guided scene questions for mood, setting, visual
style, palette, and gameplay emphasis. These answers are folded into the saved
art brief so local and cloud providers receive the same structured context.

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
4. Enter the exact checkpoint filename visible in ComfyUI, including extension.
5. Choose a generation target from the active prompt pack.
6. Optionally set a seed.
7. Click **Generate And Import Asset**.

The editor queues a small text-to-image workflow through `POST /prompt`, polls
`GET /history/{prompt_id}`, downloads the generated image through `/view`, saves
it under `assets/imported`, and registers a normal image asset document.

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
