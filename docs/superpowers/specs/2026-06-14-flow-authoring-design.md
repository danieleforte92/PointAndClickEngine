# Flow Authoring Design

Date: 2026-06-14
Status: Proposed

## Goal

Extend the editor so it can persist narrative flow edits for the current flow document using a structured inspector, without introducing a node canvas yet.

## Scope

Included:

- selectable flow entries in the editor project tree
- `flow/update` command persisted through `packages/project-io`
- inspector-based editing for:
  - flow `name`
  - `startNodeId`
  - node list
- support for the current node types:
  - `line`
  - `set-flag`
  - `end`
- add node
- remove node
- update node fields
- project reload after save
- persistence tests for flow editing

Excluded:

- canvas or graph editing
- reordering via drag and drop
- new node types
- branching choices
- conditions
- nested flow calls

## Why This Shape

The runtime and sample content already model flows as explicit node documents. We now have a stable editor persistence path for hotspots, scenes, and locales. The next aligned move is to use the same command pipeline for flows rather than inventing a different narrative editor architecture too early.

This keeps the project moving toward a complete authoring tool while staying inside a tractable vertical slice.

## Options Considered

### Option A: Structured list editor

Represent the flow as an ordered list of editable node cards inside the inspector.

This is the chosen option because it balances implementation speed, clarity, and real usefulness. It is also compatible with a future graph editor because it preserves the same underlying document shape.

### Option B: Dense table editor

Represent nodes as rows in a compact grid.

Rejected for now because heterogeneous node types become harder to read and maintain in a cramped layout.

### Option C: Graph canvas first

Build a mini node editor immediately.

Rejected for now because it is much broader than the current step and would slow down delivery of validated flow authoring.

## Architecture

### `packages/project-io`

`EditorProjectCommand` grows with:

- `flow/update`

Recommended payload shape:

- `flowId`
- `patch`
  - `name`
  - `startNodeId`
  - `nodes`

Responsibilities:

- resolve the referenced flow file from the project manifest
- load the project
- replace the editable parts of the addressed flow
- validate the resulting `FlowDocument`
- write the updated JSON file
- reload and return the project

### Editor snapshot and selection

The editor snapshot should include flow documents so the renderer does not need a second fetch path.

The UI keeps one active inspector target at a time:

- hotspot
- scene
- locale
- flow

When a flow is selected, hotspot focus and locale focus should clear.

### Editor UI

The project tree renders flow entries as selectable buttons.

The flow inspector shows:

- flow id (read-only)
- flow name
- start node id
- node cards for the current node list
- actions to add `line`, `set-flag`, or `end` nodes
- remove action per removable node
- save action for the whole flow

## Data Model

`flow/update` supports the current schema only:

- `line`
  - `id`
  - `speakerId`
  - `textKey`
  - `next`
- `set-flag`
  - `id`
  - `key`
  - `value`
  - `next`
- `end`
  - `id`

The editor works against the full node list for this step. That keeps the persistence layer simple and makes validation straightforward.

## Validation Rules

- flow `name` must be non-empty
- `startNodeId` must reference an existing node id
- each node id must be non-empty and unique
- every `next` field must reference an existing node id
- at least one node must exist
- at least one `end` node should exist in the editor before save
- the final document must pass `assertDocument<FlowDocument>()`

The editor should block obvious bad input before IPC where practical, but schema validation in `project-io` remains authoritative.

## UI Design

### Flow inspector

Top section:

- flow id
- flow name
- start node id

Node section:

- one card per node
- node type label
- type-specific fields
- remove action

Creation section:

- add line node
- add set-flag node
- add end node

Save behavior:

- one `Apply changes` action persists the current draft flow
- after save, the same flow stays selected

### Node editing behavior

`line` node:

- editable `id`
- editable `speakerId`
- editable `textKey`
- editable `next`

`set-flag` node:

- editable `id`
- editable `key`
- editable `value`
- editable `next`

For this step, `value` can stay string-based in the inspector and be converted to boolean or number only if that is already easy to infer. If not, we keep it as string for now and rely on existing sample-compatible usage or add a simple type selector during implementation.

`end` node:

- editable `id`

## Error Handling

- invalid references, duplicate ids, or missing `end` nodes should surface as status errors in the editor
- deleting a node that is still referenced by `startNodeId` or another node's `next` must either be blocked or force the user to repair references before save
- persistence remains single-document and atomic at the command level

## Testing

Add `project-io` tests for:

- updating flow name and start node id
- adding a node and persisting it
- removing a node and persisting the resulting flow

Verification pass:

- `pnpm test`
- `pnpm typecheck`
- `pnpm validate:sample`
- `pnpm --filter @pointclick/editor typecheck`
- `pnpm --filter @pointclick/editor build`

## Implementation Notes

Suggested order:

1. extend `project-io` with `flow/update`
2. add persistence tests
3. extend editor snapshot with flows if needed
4. add flow selection in the project tree
5. add flow draft state and inspector UI
6. validate and package the editor

## Risks And Limits

- editing references by id is more error-prone than a graph canvas, so validation messaging matters
- removing nodes can orphan references if the UI is too permissive
- mixed scalar types on `set-flag.value` are the one detail most likely to need a small UI compromise in this step

## Done Criteria

This step is complete when:

- the editor can select a flow from the tree
- the inspector can modify, add, and remove current flow nodes
- validated flow changes persist to disk
- the selected flow remains active after save
- automated validation passes
