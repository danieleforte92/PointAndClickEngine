# Local AI Provider Integration Design

Date: 2026-06-25
Status: Approved

## Goal

Extend the editor AI workspace so a creator can use local providers without
paid cloud keys:

- LM Studio drafts structured prompt packs from guided scene questions.
- ComfyUI generates image assets from approved prompt-pack targets.

## Scope

Included:

- `lmstudio` prompt provider using OpenAI-compatible local endpoints.
- Guided scene questions that enrich the art brief before generation.
- `comfyui` image provider through the Electron main process.
- Generate one image target at a time from the selected prompt pack.
- Save generated PNGs under `assets/imported` and register them as normal
  imported image assets.
- Provenance returned to the editor for review.
- Focused mocked provider tests and user documentation.

Excluded:

- Public network exposure for local AI servers.
- Arbitrary ComfyUI workflow editing.
- Inpainting, masks, batch queues, or sprite sheet extraction.
- Automatic scene assignment after image generation.

## Provider Boundaries

Prompt providers return prompt-pack candidates and never write project files.
Image providers return generated asset metadata through the main process after
the generated file has been saved and registered in the project.

LM Studio defaults:

- base URL: `http://localhost:1234/v1`
- endpoint preference: `/responses`, with `/chat/completions` fallback
- API key: optional, defaults to `lm-studio`

ComfyUI defaults:

- base URL: `http://127.0.0.1:8188`
- endpoint flow: `POST /prompt`, poll `GET /history/{prompt_id}`, then fetch
  `GET /view?...`
- workflow: generated from a small text-to-image template with configurable
  dimensions, seed, prompt, and negative prompt
- custom API workflow path: optional; patch checkpoint, dimensions, seeds,
  filename prefix, and prompt nodes before queueing
- prompt injection: when an API workflow has no `CLIPTextEncode` prompt nodes
  but exposes a checkpoint and standard `KSampler`, inject positive and negative
  prompt nodes and wire them to the sampler

## Editor UX

The AI workspace has two clear sections:

- Prompt drafting: choose Mock, OpenAI, or LM Studio; fill guided scene answers;
  generate and save a prompt pack.
- Image generation: choose ComfyUI, select a generation target from the latest
  or saved prompt pack, generate, import, and review the resulting asset.

Provider secrets and local URLs stay in renderer state only. They are not saved
to project files.

## Error Handling

Provider failures create no project mutations except when the generated image
has already been fully saved and registered. Network and malformed response
errors are shown in the editor status area.

ComfyUI is assumed to run only on `127.0.0.1` or `localhost`; docs warn against
exposing it unauthenticated on a public interface.

## Verification

- Mock LM Studio and ComfyUI fetch calls in unit tests.
- `pnpm typecheck`
- targeted editor/provider tests
- `pnpm validate:sample`
- `pnpm validate:starter`
