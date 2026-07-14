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

The Electron renderer reaches project files and provider integrations only
through an injectable editor gateway. Production uses the preload IPC adapter;
tests can supply an in-memory adapter without exposing Node APIs to React.

Editor navigation is a small state machine with separate authoring and Test Lab
modes. Entering Test Lab records the previous authoring workspace and selection,
so closing it restores the creator's context instead of routing to a fixed page.

## Authoring Persistence

Canonical project documents remain the only durable source of truth. Valid
field edits use an 800 ms per-document autosave debounce. Asset assignment,
animation assignment, project settings, AI approval, and other high-impact
operations remain explicit commands.

While an edit is invalid or not yet applied, the editor stores a recovery draft
outside canonical project JSON. Opening the project offers recovery or discard.
Document writes are atomic; the semantic change journal records successful
authoring commands after persistence.

## Preview

The web player contains no Electron APIs.

- Development preview uses the Vite player server.
- Electron opens that URL in a sandboxed `BrowserWindow`.
- The Browser command opens the same URL externally.
- Packaged Electron embeds the production player assets and serves them from an
  ephemeral `127.0.0.1` HTTP server.
- Playwright tests the same web surface used by preview and export.

The Electron renderer has `contextIsolation`, sandboxing, and no Node integration.
Preload exposes typed, purpose-specific project, preview, build, asset, and AI
methods rather than a general IPC bridge.

**Play** creates one tokenized, expiring preview session. Test Lab embeds the
player in a sandboxed iframe and stores its logical input actions and debug
snapshots on the `embedded` track. Opening **Browser** replays those actions into
the same project bundle on a separate `browser` track. Comparison ignores DOM
timing and animation frames and reports the first divergent runtime field.

Preview endpoints bind to loopback, validate the session token and origin, cap
payload sizes and item counts, and disappear when the session expires or closes.

## Scene Contract

The public scene union already distinguishes `layered-2d` and `hybrid-3d`.
Only `layered-2d` is executable in the current milestone.

Layered scenes define:

- dimensions and background;
- optional image layers for foregrounds, overlays, and parallax-ready composition;
- player start, optional player animation pack, and walk bounds;
- depth-ordered visual shapes;
- actors, pickups, rectangular hotspots, and their flow IDs.

Renderer objects are never serialized into project or save data.

## Narrative Contract

The Flow VM and graph editor share the same typed intermediate representation.
The built-in graph supports line, set-flag, change-scene, choice, condition,
sub-flow, inventory, wait, cue, and end nodes. Graph edges compile back into
`next`, `ifTrue`, `ifFalse`, and `choices[].next`; saved editor layout is optional
authoring metadata and never affects runtime execution.

Execution yields presentation cues while applying state commands through the
same command/event core. The graph surface adds typed handles, diagnostics,
selection, pan/zoom, minimap, and deterministic layout without becoming a
second gameplay model.

## Resource, Asset, And AI Boundary

Resources is a derived, federated index over project documents. It calculates
health and reverse usages for scenes, image/audio assets, animation packs,
flows, locales, items, prompt packs, style bibles, workflows, and recipes. The
index is navigation data, not another persisted catalog.

Assets and animation packs are project documents. Image processing is
non-destructive: crop, chroma cleanup, and optimization create a derived asset
with parent lineage and processing metadata. Applying the derived file and
assigning it to a scene entity are separate actions. Audio assets carry channel,
volume, loop, and optional caption metadata; the runtime resolves sound cues by
asset ID. Simulation state still stores only IDs, positions, flags, inventory,
and event sequence.

Prompt packs are authoring documents, not runtime dependencies. Creator Alpha
ships a deterministic mock-provider path, local LM Studio support, local ComfyUI
image generation, and saved prompt-pack provenance so contributors can inspect
the AI direction without paid provider keys.

Image providers return bytes to a session-only candidate store. Candidate cards
expose preview, dimensions, seed, warnings, provider/model, latency, cost, and
provenance. No project document or asset file is written until the creator
chooses **Apply to Project**; discard and project switching make candidates
ineligible for application. Transparency and alpha output can come from ComfyUI
workflows or from Asset Studio's chroma-key tool; neither path changes runtime
assumptions.

## Static Web Build

Build export first validates the saved project and rejects unresolved errors or
dirty recovery drafts. It then copies the production player, canonical asset
files, and a validated `project.bundle.json` into a chosen empty folder. The
export contains no Electron API and uses the same web player entry point as
preview.
