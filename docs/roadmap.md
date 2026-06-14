# Roadmap

## Foundation Vertical Slice

Completed:

- monorepo, strict TypeScript, pnpm, Vitest, and Playwright;
- project, scene, flow, and locale schemas;
- CLI project validation;
- deterministic commands, events, replay, and seeded RNG;
- minimal narrative Flow VM;
- PixiJS layered-2D scene rendering;
- walking, hotspot activation, flags, localized dialogue;
- web player and sample game;
- Electron editor shell and isolated preview;
- embedded standalone player for packaged Electron;
- Windows x64 package verification.

## Next: 2D Authoring

- Load arbitrary project folders in the editor.
- Persist inspector and scene edits through validated commands.
- Add transactional undo/redo and autosave recovery.
- Replace rectangular walk bounds with polygons and pathfinding.
- Add inventory, item combinations, choices, conditions, and flow calls.
- Add save envelopes, slots, checkpoints, and migration tests.
- Build the real graph/script narrative editor.
- Add audio cues, subtitle timing, and localization diagnostics.

## Later Milestones

1. AI Asset Studio with provider adapters, provenance, immutable versions, masks,
   layer extraction, character identity packs, and TTS drafts.
2. Three.js hybrid scenes with GLB/glTF, camera rigs, navmesh, lighting,
   collision proxies, sprites, and billboards.
3. Desktop exporters, accessibility, profiling, crash recovery, plugin SDK,
   private alpha, and the complete 30–60 minute sample adventure.

Cloud collaboration, runtime LLMs, mobile export, integrated 3D modeling, and
generative music remain outside the first public release.

