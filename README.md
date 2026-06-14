# Point & Click Engine

Open-core TypeScript engine and visual editor for classic and modern point-and-click
adventures. The repository currently implements the first playable foundation:

- open, validated project documents;
- deterministic command/event game state;
- a small narrative Flow VM;
- a PixiJS layered-2D renderer;
- a web player with a playable sample scene;
- an Electron/React editor shell;
- isolated Electron and external-browser preview paths;
- unit, schema, E2E, typecheck, and packaging verification.

The sample game, **The Isle of Echoes**, supports walking, activating the tavern
hotspot, setting world state, and completing a localized dialogue flow.

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

## Verify

```powershell
pnpm test
pnpm test:e2e
pnpm typecheck
pnpm validate:sample
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
and [Roadmap](docs/roadmap.md).

