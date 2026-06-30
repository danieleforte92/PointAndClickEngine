# Creator Alpha Roadmap

Creator Alpha is the first public open-source release target for Point & Click
Engine. The goal is not feature breadth. The goal is a coherent product loop:
clone the repo, run the editor, inspect the sample, create or open a project,
author a small scene, generate reviewable AI art direction, validate, and preview.

## Baseline Already Usable

- Git-friendly project documents with schema and semantic validation.
- Deterministic command/event runtime, seeded RNG, replayable state, and Flow VM.
- Layered 2D Pixi renderer with image layers, polygon walk areas, pickups,
  inventory, verbs, scene transitions, and scale-by-depth player movement.
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
  start, walk areas, and a minimal visual layer stack.
- Player authoring: Scene > Player handles asset, animation pack, start
  position, walk speed, scale-near/far, and immediate preview.
- Actor/hotspot authoring: guided asset/animation/flow references and inline
  validation when references are missing.
- Build workspace: saved-project validation, preview readiness, and clear error
  feedback.

Done when the sample can be modified and previewed without editing JSON by hand.

## Milestone 3 - AI Workflow Engine

Turn AI support into a bounded local workflow engine, not a prompt-only panel.

- Keep prompt packs as reviewable art-direction drafts, then compile approved
  targets into explicit asset-generation recipes.
- Add a workflow registry for approved ComfyUI API templates with declared
  inputs, patch bindings, output mode, hardware profile, and limitations.
- Store generated-asset provenance: prompt, negative prompt, seed, model,
  workflow id, target id, dimensions, references, masks, warnings, and parent
  asset lineage.
- Support RTX 3070 8GB-friendly draft and preview presets for 16:9 backgrounds
  and isolated prop or character outputs.
- Upload reference images and masks to ComfyUI for img2img and inpaint workflows
  instead of relying only on text-to-image generation.
- Make recipe preview, queue status, timeout, import success, workflow
  limitations, and provenance visible in the editor.
- Keep deterministic mock output as the default CI and open-source path; LM
  Studio, ComfyUI, and OpenAI remain optional provider integrations.
- Sprite-sheet and animation-reference targets hand off to Asset Studio so they
  can be sliced into animation packs in Character Gym.

Done when a creator can generate a prompt pack, approve a recipe, generate and
import a local asset, assign it to a scene entity, inspect provenance, validate,
and preview without editing JSON by hand.

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
- Remaining work is production polish: better generated sheet presets, stronger
  frame-consistency guidance, and clearer validation around missing clips.

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
