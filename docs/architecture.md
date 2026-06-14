# Architecture

## Boundaries

The serializable core is the source of truth. Editor, renderer, player UI, and
future AI services consume public contracts and must not own gameplay state.

```text
Project documents
       |
       v
contracts -> core -> flows -> runtime
                              |
                    +---------+---------+
                    |                   |
               renderer-2d         future renderer-3d
                    |
              player web UI
                    |
          Electron or external browser
```

`GameCommand` expresses requested changes. `DomainEvent` records accepted changes.
`WorldState` is produced only by replaying those events. This gives save/load,
debug tracing, replay, and future undo tooling one common foundation.

## Preview

The web player contains no Electron APIs.

- Development preview uses the Vite player server.
- Electron opens that URL in a sandboxed `BrowserWindow`.
- The Browser command opens the same URL externally.
- Packaged Electron embeds the production player assets and serves them from an
  ephemeral `127.0.0.1` HTTP server.
- Playwright tests the same web surface used by preview and export.

The Electron renderer has `contextIsolation`, sandboxing, and no Node integration.
Only the two explicit preview IPC methods are exposed by preload.

## Scene Contract

The public scene union already distinguishes `layered-2d` and `hybrid-3d`.
Only `layered-2d` is executable in the current milestone.

Layered scenes define:

- dimensions and background;
- player start and walk bounds;
- depth-ordered visual shapes;
- rectangular hotspots and their flow IDs.

Renderer objects are never serialized into project or save data.

## Narrative Contract

The first Flow VM supports:

- localized dialogue lines;
- deterministic flag changes;
- explicit end nodes.

Execution yields one presentation line at a time while applying state commands
through the same command/event core. Conditions, choices, calls, waits, and
timeline cues will extend this IR without changing the runtime boundary.

