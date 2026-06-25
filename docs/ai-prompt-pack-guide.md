# AI Prompt Pack Guide

Prompt packs are authoring artifacts for art direction. They are not required at
runtime and Creator Alpha does not call paid AI providers.

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

## Provider Boundary

Creator Alpha supports deterministic mock output only. Real providers should be
added behind a provider interface that returns a complete `PromptPackDocument`
and never mutates project files until the user approves and saves the result.

Provider integrations must document:

- required environment variables;
- request and response shape;
- cost and rate-limit behavior;
- provenance fields;
- failure behavior.

## Release Rule

The open-source release must remain useful without provider keys. Sample prompt
packs should validate from checked-in JSON and should never depend on external
network calls.
