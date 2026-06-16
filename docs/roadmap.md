# Roadmap

## Current Baseline

Completed or already usable in the current codebase:

- monorepo, strict TypeScript, pnpm, Vitest, Playwright, and packaged Electron;
- project, scene, flow, locale, item, and asset schemas with CLI validation;
- deterministic commands, events, replay, and seeded RNG;
- layered 2D runtime with polygon walk areas and pathfinding;
- light classic verbs, inventory, pickups, and item-specific hotspot actions;
- web player, sample game, isolated Electron preview, browser preview, and packaged preview;
- editor project loading for arbitrary folders;
- inspector persistence for scenes, hotspots, pickups, items, locales, and linear flows;
- editor undo/redo, dirty drafts, and autosave recovery;
- build workspace validation for saved project content;
- asset library import, health display, usage display, and scene background assignment.

## Next Milestone: Authoring Autonomy

Goal: finish the jump from "structured inspector on top of JSON" to "I can build a small adventure entirely inside the editor."

- done now:
  - create and remove scenes, hotspots, pickups, items, and flows from the editor;
  - scene background assignment from the asset workspace;
  - flow and item references in hotspot and pickup inspectors moved from free text to guided pickers.
- next up:
  - add create and remove actions for locale keys and asset records from the editor;
  - replace remaining free-text references with pickers or autocomplete where possible;
  - surface reference-aware validation inline in the inspector before save;
  - add direct viewport tools for hotspot bounds, pickup bounds, player start, and walk area polygons;
  - add asset maintenance actions: rename, relink, replace, delete unused;
  - split the editor surface into smaller scene, narrative, assets, and build modules while keeping one shared draft session.

### Suggested Implementation Order

1. Inline authoring safety:
   locale key CRUD, missing-reference badges, picker defaults, and inspector guardrails.
2. Visual scene tools:
   drag-resize hotspots and pickups, move player start, and edit walk polygons in the viewport.
3. Asset maintenance:
   replace, relink, rename, and delete-unused actions with validation feedback.
4. Editor modularization:
   extract scene, narrative, asset, and build panels into focused modules without changing behavior.

Done when a small multi-room adventure can be authored without manual file edits.

## Next Milestone: Narrative And Puzzle Authoring

- extend the flow model with choices, conditions, flow calls, scene transitions, and timeline cues;
- build a real graph editor on top of the flow document model;
- add validation for dead branches, missing references, and puzzle logic gaps;
- add a puzzle dependency view that connects items, hotspots, flags, and flows.

## Next Milestone: Production And Playtest

- add save slots, checkpoints, migration coverage, and recovery hardening;
- add debug and playtest tools: event log, world state inspector, inventory and flag inspection, jump-to-scene helpers;
- add audio cues, ambience, subtitle timing, and localization diagnostics;
- add export gates for validation, missing assets, and preview readiness.

## Later Milestones

1. AI Asset Studio with provider adapters, provenance, immutable versions, masks,
   layer extraction, character identity packs, and TTS drafts.
2. Hybrid 3D scene support with GLB/glTF, camera rigs, navmesh, lighting,
   collision proxies, sprites, and billboards.
3. Desktop and web export workflows, accessibility, profiling, plugin SDK,
   private alpha, and the complete 30-60 minute sample adventure.

Cloud collaboration, runtime LLMs, mobile export, integrated 3D modeling, and
generative music remain outside the first public release.
