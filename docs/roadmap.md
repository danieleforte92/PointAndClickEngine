# Creator Alpha Roadmap

Creator Alpha is the first public open-source release target for Point & Click
Engine. The goal is not feature breadth. The goal is a coherent product loop:
clone the repo, run the editor, inspect the sample, create or open a project,
author a small scene, generate reviewable AI art direction, validate, and preview.

## Baseline Already Usable

- Git-friendly project documents with schema and semantic validation.
- Deterministic command/event runtime, seeded RNG, replayable state, and Flow VM.
- Layered 2D Pixi renderer with polygon walk areas, pickups, inventory, verbs,
  scene transitions, and scale-by-depth player movement.
- Web player, Electron editor, isolated preview, browser preview, and packaged
  Windows preview.
- Editor project creation/opening, undo/redo, autosave recovery, scene tools,
  narrative editing, asset import, validation, prompt packs, and local image
  generation.
- Sample adventure with two scenes, player animation pack, actor animation pack,
  item use, dialogue, transition, and prompt-pack provenance.

## Milestone 1 - Public Repository Readiness

Make the repo understandable to a first-time visitor.

- Keep `starter-game` minimal and free of generated experiments.
- Keep `sample-game` intentional, valid, and presentation-ready.
- Maintain one public roadmap and remove stale duplicate planning documents.
- Keep `README.md` focused on product promise, quick start, what works, what is
  limited, and what to try first.
- Maintain `pnpm check` as the release gate.
- Add release checklist and troubleshooting notes for local provider workflows.

Done when a clean checkout can be installed, validated, built, and explained
from the README without private context.

## Milestone 2 - Editor UX Completion

Make the editor feel like a product rather than a JSON inspector.

- First-run actions: create blank project, create from starter, open project.
- Scene authoring: direct viewport editing for hotspots, pickups, actors, player
  start, and walk areas.
- Player authoring: asset, animation pack, start position, walk speed,
  scale-near/far, and immediate preview.
- Actor/hotspot authoring: guided asset/animation/flow references and inline
  validation when references are missing.
- Build workspace: saved-project validation, preview readiness, and clear error
  feedback.

Done when the sample can be modified and previewed without editing JSON by hand.

## Milestone 3 - AI Asset Studio

Turn AI support into a bounded authoring workflow.

- Prompt-pack presets for visual style, mood, setting, palette, gameplay
  emphasis, targets, and negative prompts.
- Provider paths: deterministic mock, LM Studio local, optional OpenAI, and
  ComfyUI local image generation.
- ComfyUI workflow support for room backgrounds, prop sheets, character sheets,
  chroma-key generation, and transparent PNG output where the workflow supports
  alpha.
- Clear status for queueing, timeout, import success, and workflow limitations.
- Imported generations become normal project assets under `assets/imported`.

Done when a creator can generate a prompt pack, generate one asset locally,
import it, assign it, validate, and preview.

## Milestone 4 - Character Gym MVP

Make player and actor animation authorable, not just loadable.

- Asset Studio controls for selecting a spritesheet asset are available.
- Frame size, grid, foot origin, default facing, clip fps, loop flag, and clip
  frame lists are editable.
- Default clips `idle`, `walk`, and `talk` are scaffolded; extra clips are
  allowed.
- Animation packs can be assigned to the current player draft or selected actor
  draft from the editor UI.
- Renderer fallback remains visible when assets or packs are missing.
- Animated clip preview and visual frame slicing are available in Asset Studio.

Done when the sample player and one actor can be edited, assigned, validated,
and played from the editor; clip preview completes the polish pass.

## Milestone 5 - Creator Alpha Release

Ship the first public GitHub release.

- Tag `creator-alpha`.
- Include release notes, screenshot/GIF, quick start, known limitations, and
  "what to try first".
- Verify Windows package output.
- Keep hosted demo and marketing site out of the critical path.

Done when a technical creator can clone the repo, run it, understand the data
model, try the sample, create a small project, and see the AI/animation direction
without paid provider keys.

## Later

- Flow graph editor with choices, conditions, calls, timeline cues, and puzzle
  dependency view.
- Save slots, checkpoints, debug world-state overlay, localization diagnostics,
  and audio tools.
- Web export, accessibility pass, profiling, plugin SDK, hosted demo, and public
  website.
- Hybrid 3D scene support.

Cloud collaboration, runtime LLMs, mobile export, integrated 3D modeling, and
generative music are outside Creator Alpha.
