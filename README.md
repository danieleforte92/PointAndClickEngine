# Point & Click Engine

Open-core TypeScript engine and visual editor for classic and modern point-and-click
adventures. The repository currently implements the first playable foundation:

- open, validated project documents;
- deterministic command/event game state;
- a small narrative Flow VM;
- a PixiJS layered-2D renderer;
- a web player with a playable two-scene sample;
- an Electron/React editor shell;
- mock-only AI prompt pack documents;
- MVP animation pack documents for sprite clips;
- isolated Electron and external-browser preview paths;
- unit, schema, E2E, typecheck, and packaging verification.

The sample game, **The Isle of Echoes**, supports walking, activating hotspots,
collecting inventory, using an item, changing scenes, and completing localized
dialogue flows.

## Why This Exists

Point & Click Engine is aimed at teams who want classic adventure-game structure
without hiding the project behind opaque binaries or editor-only state. The
project keeps the source of truth in Git-friendly documents, runs on a
deterministic command/event core, and layers visual authoring on top so the
engine, editor, and sample game can evolve together.

## Build In Public

The project is being reorganized so each milestone produces something easy to
share publicly: a GIF, short demo video, screenshot set, technical post, or
playable slice. The current content-driven roadmap lives in
[docs/content-driven-roadmap.md](docs/content-driven-roadmap.md), and media for
future posts can live under `docs/assets/`.

![Current sample player demo](docs/assets/sample-player-demo.png)

## AI-Assisted, Human-Directed

AI is planned here as a focused assistant for authors, not a magic "generate a
whole game" button. The intended uses are narrow, reviewable tasks such as
puzzle drafts, dialogue drafts, validation explanations, NPC profiles, and
asset prompt generation while keeping design direction and final editorial
control in human hands.

## Requirements

- Node.js 22.17 or newer; Node.js 24 LTS is recommended.
- pnpm 9.6.

## Start

```powershell
pnpm install --force
pnpm dev
```

`pnpm dev` starts the player at `http://127.0.0.1:5173` and the Electron editor.
Use **Play from here** for the isolated Electron preview or **Browser** for the
system browser.

## Sample Game

The current sample is intentionally small, but it already demonstrates the
core point-and-click loop end to end:

`scene -> hotspot -> inventory -> item use -> flow -> state update -> transition`

In **The Isle of Echoes**, the player can walk the dock, inspect the tavern
door, collect the rusty hook, use it on the tavern entrance, enter the tavern,
and see the world state update through the same deterministic runtime used by
the editor preview and web player.

## Verify

```powershell
pnpm test
pnpm test:e2e
pnpm typecheck
pnpm validate:sample
pnpm validate:starter
pnpm build
```

The packaged Windows editor is written to:

```text
apps/editor/out/PointClickStudio-win32-x64/
```

Its player bundle is embedded and served from an ephemeral loopback HTTP server,
so packaged preview does not require a development server or an installed browser.

## Repository

```text
apps/editor            Electron/React authoring shell
apps/player-web        Web player and preview target
apps/sample-game       Open project documents for the sample adventure
packages/contracts     JSON Schema-compatible public documents
packages/core          Deterministic commands, events, state, and RNG
packages/flows         Narrative flow execution
packages/runtime       Renderer-independent adventure orchestration
packages/renderer-2d   PixiJS layered scene renderer
packages/cli           Project validation commands
```

See [Architecture](docs/architecture.md), [Project Format](docs/project-format.md),
the [Authoring Tutorial](docs/authoring-tutorial.md),
[AI Prompt Pack Guide](docs/ai-prompt-pack-guide.md),
[Character Gym Guide](docs/character-gym-guide.md), the technical
[Roadmap](docs/roadmap.md), and the [Content-Driven Roadmap](docs/content-driven-roadmap.md).
