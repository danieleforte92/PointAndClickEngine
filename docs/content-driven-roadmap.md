# Content-Driven Roadmap

## Vision

Point & Click Engine is shifting from a purely technical milestone sequence to a
content-driven development loop. The engine, editor, and sample game should
keep getting more capable, but each milestone must also produce something easy
to show in public: a short demo, GIF, screenshot, devlog, technical post, or
playable slice.

The goal is not to dilute the engine work. The goal is to make every meaningful
technical step legible to other people.

## Current State

### Engine Foundation

- Operational today: Git-friendly project documents, schema validation,
  deterministic commands and events, replayable world state, seeded RNG, linear
  Flow VM, layered 2D runtime, polygon walk areas, inventory, pickups, verbs,
  and item-specific hotspot actions.
- Strong but not very visible: replayability, deterministic state transitions,
  runtime boundaries, and validation guarantees are technically valuable but
  need better storytelling to land publicly.

### Visual Editor

- Operational today: Electron shell, project loading, scene and narrative
  inspectors, asset import and relink flows, validation workspace, undo/redo,
  autosave recovery, and CRUD for scenes, hotspots, pickups, items, and flows.
- Still fragile or incomplete for demos: remaining free-text references,
  limited inline validation surfacing, and a visual authoring story that is
  improving but not yet obviously "show me that again" material.

### Sample Game

- Operational today: a single-scene mini loop in **The Isle of Echoes** with
  walk, inspect, pickup, item use, and flow-driven state change.
- Current limitation: the sample proves the architecture, but it is still too
  small to carry repeated public updates without deliberate demo polish.

### AI-Assisted Roadmap

- No vertical AI assistant is implemented yet.
- The intended direction is explicit: AI should assist with authoring tasks
  such as puzzle drafts, dialogue drafts, NPC profiles, validation explanation,
  and asset prompt generation. It should not be positioned as a full game
  generator.

### Publicly Shareable Material

- Immediate content available now: runtime loop GIFs, editor screenshots,
  validation/build workflow posts, architecture posts about deterministic state,
  and sample-game walkthrough clips.
- Near-term opportunity: make the sample and editor surfaces more visually
  communicative so every milestone naturally yields a short shareable artifact.

## Milestones

### Milestone A - Public Presentation

Objective: make the project presentable to someone seeing it for the first time.

Priority tasks:

- strengthen the README with project intent, sample loop, and AI positioning;
- prepare `docs/assets/` as the home for screenshots and GIFs;
- document the sample game as the current proof of the engine/editor loop;
- link the public-facing README to this roadmap and the technical docs.

Done when:

- the repository has a readable public entrypoint;
- a new visitor can understand what exists now and what comes next;
- at least one asset is ready or planned for public presentation.

Public output:

- README-ready screenshot or GIF;
- short "why this exists" post;
- mini devlog about the shift toward content-driven milestones.

### Milestone B - Demo-First Sample

Objective: turn the sample game into a stronger demonstration surface.

Priority tasks:

- make the gameplay loop visually and textually clearer;
- improve sample naming, feedback, or microcopy where it helps the demo;
- add a lightweight checklist for recording a 15-30 second clip;
- document the exact loop to capture: scene, hotspot, inventory, item use,
  flow, state change.

Done when:

- the sample can be recorded in one short take without explanation;
- the loop reads clearly to someone who has never seen the repo;
- the milestone produces at least one shareable capture.

Public output:

- GIF of the full sample loop;
- short video demo;
- post explaining how the sample proves the runtime contract.

### Milestone C - Visual Authoring

Objective: make the editor look and feel like a visual tool, not only a
structured inspector.

Priority tasks:

- viewport hotspot selection and direct manipulation;
- drag/resize hotspot bounds;
- visual player start editing;
- visual walk area editing;
- inline validation feedback and missing-reference badges;
- picker or autocomplete replacements for remaining fragile references.

Done when:

- a core scene can be edited without dropping into JSON;
- the editor visibly communicates correctness and broken references;
- the milestone produces at least one before/after visual comparison.

Public output:

- before/after editor screenshots;
- GIF of direct hotspot or walk-area editing;
- technical post on authoring UX guardrails.

### Milestone D - Shareable AI Assistant

Objective: introduce AI as a serious, narrow authoring assistant.

Priority tasks:

- puzzle draft assistant;
- dialogue draft assistant;
- NPC profile generator;
- asset prompt generator;
- validation explanation assistant.

Done when:

- at least one assistant workflow produces useful draft output that a human can
  review and edit;
- the AI surface is clearly bounded and non-gimmicky;
- the milestone produces at least one concrete example worth sharing.

Public output:

- post showing input, draft output, and human revision;
- short demo of one assistant workflow;
- explanation of why AI is scoped to assistive tasks.

### Milestone E - First Complete Mini-Adventure

Objective: ship a vertical slice that feels like an actual tiny adventure.

Priority tasks:

- expand to 2-3 scenes;
- add 1-2 NPCs;
- add 5-8 items;
- build 2-3 puzzles;
- include at least one branching dialogue;
- prepare a final demo capture and optional playable build.

Done when:

- the slice can be played start to finish;
- the content demonstrates engine, editor, and authoring direction together;
- the milestone produces at least one shareable final artifact.

Public output:

- final demo video;
- playable build if distribution is ready;
- retrospective devlog on building the first complete mini-adventure.

## Next 30 Days

1. Finish public presentation improvements so the repo is easier to share.
2. Make the sample demo-first with clearer capture steps and more readable flow.
3. Prioritize editor changes that are visually demonstrable, especially direct
   manipulation and inline validation.
4. Package one or two technical explanations around deterministic runtime and
   preview architecture.
5. Avoid starting broad AI work until one narrow assistant workflow has a clear
   demo story.

## Demo-Friendly Backlog

- editor capability screenshots with status callouts;
- sample recording checklist for repeatable GIF capture;
- build-validation screenshots with annotated diagnostics;
- event-log or replay-focused debug presentation;
- inventory and item-use loop polish;
- stronger scene art or temporary presentation assets for the sample;
- short technical notes on preview isolation and packaged playback.

This backlog is intentionally opportunistic. It is a pool of demo-friendly
ideas, not a promise that every item is already scheduled.

## Content Ideas By Milestone

- Milestone A: "Why this exists", repo tour, architecture snapshot, README
  refresh post.
- Milestone B: 15-second loop demo, sample puzzle clip, "small sample, real
  runtime" thread.
- Milestone C: before/after editor comparison, direct-manipulation GIF, inline
  validation post.
- Milestone D: AI assistant example with human revision, scoped-AI design post,
  validation-explainer demo.
- Milestone E: playable slice trailer, release thread, retrospective on what
  became possible once the sample turned into a real mini-adventure.
