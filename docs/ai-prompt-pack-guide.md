# AI Prompt Pack Guide

Prompt packs are authoring artifacts for art direction. They are not required at
runtime. Creator Alpha remains usable without paid provider keys, but the editor
can optionally call the OpenAI Responses API when the user configures an API key.

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
4. Generate a candidate prompt pack.
5. Review background, prop, character, animation, target, actor, and provenance
   sections.
6. Save only when the candidate is approved.

Generation does not mutate project files. The editor writes a prompt-pack JSON
document only after **Save Approved Pack**.

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
only a ChatGPT subscription.

## Release Rule

The open-source release must remain useful without provider keys. Sample prompt
packs should validate from checked-in JSON and should never depend on external
network calls. Tests must mock provider calls instead of hitting paid APIs.
