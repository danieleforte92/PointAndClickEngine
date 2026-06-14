# Polygon Walk Areas And Pathfinding Design

Date: 2026-06-14
Status: Proposed

## Goal

Replace rectangular layered-2D walk bounds with polygon walk areas and add real pathfinding for player movement, while keeping the current foundation runtime and editor workflows coherent.

## Scope

Included:

- replace `walkArea: Rect` with a polygon walk area in layered-2D scenes
- add runtime geometry helpers for point containment, closest walkable target projection, and pathfinding
- support a single walkable polygon per layered-2D scene
- update editor scene authoring to inspect and edit polygon vertices
- update sample project content to the new scene format
- add automated coverage for schema validation, geometry, runtime navigation, and project persistence

Excluded:

- holes inside walkable areas
- multiple walkable islands in a single scene document
- explicit obstacle polygons
- hybrid-3d navigation changes
- spline motion, animation blending, or time-based step interpolation
- schema migration tooling for older scene files

## Why This Shape

The current runtime clamps movement to a rectangle. That works for the vertical slice, but it breaks the illusion as soon as a scene needs angled piers, curved shorelines, alcoves, or concave walk surfaces.

This step should raise spatial fidelity without forcing a full navigation-system rewrite:

- scene data becomes expressive enough for real adventure layouts
- runtime movement remains deterministic
- the editor stays authorable with simple vertex-based controls
- the system leaves room for later obstacles or richer navmesh work

## Options Considered

### Option A: Single polygon with grid-based pathfinding

Store one walkable polygon in the scene and rasterize it into a coarse logical grid for A* pathfinding.

This is the chosen option because it fits the current codebase well, keeps implementation risk moderate, and gives believable movement for both convex and concave layouts.

### Option B: Single polygon without pathfinding

Accept clicks only inside the polygon and move directly toward the target.

Rejected because it solves data expressiveness without solving navigation quality. Concave spaces would still feel broken.

### Option C: Triangulated navmesh with visibility graph or funnel

Use geometry-first pathfinding directly on polygon topology.

Rejected for now because it adds more algorithmic and editor complexity than this milestone needs.

## Architecture

### Scene schema

Introduce a polygon type in contracts:

- `Polygon2`
  - `points: Vector2[]`

Rules:

- minimum 3 points
- points are stored in scene coordinates
- points describe a simple boundary in winding order

For layered-2D scenes:

- replace `walkArea: Rect` with `walkArea: Polygon2`

### Runtime navigation module

Add a focused 2D navigation helper module under runtime with:

- point-in-polygon test
- closest point on polygon boundary
- polygon bounding box
- raster walk mask generation
- A* pathfinding on grid cells
- path simplification from cell centers into scene-space points

This module should stay pure and deterministic. The engine remains the orchestration layer.

### Engine behavior

The runtime should change `walkTo(x, y)` in layered-2D scenes as follows:

1. build or reuse a navigation grid for the current scene
2. if the click is outside the polygon, project it to the nearest walkable boundary point
3. find nearest walkable start and goal cells
4. run A* on the grid
5. if a path is found, move the character to the final resolved scene-space point
6. if no path is found, leave the character in place and return an empty movement result

For this milestone, the world state can remain endpoint-based. We do not need per-segment runtime stepping yet.

### Editor authoring

The editor should replace rectangle walk area fields with polygon vertex editing for layered-2D scenes.

Initial shape:

- existing sample and newly authored scenes use an explicit point list

Authoring controls for this milestone:

- list ordered vertices
- edit `x` and `y` numerically
- add a vertex
- remove a vertex while preserving minimum point count

Optional canvas-direct manipulation is out of scope for this milestone. Inspector-first authoring is enough.

### Persistence boundary

Project file writes remain validated and document-based:

- editor edits local draft polygon vertices
- apply builds a `scene/update` command
- `project-io` validates and writes the full scene document

No separate navigation cache needs to be persisted.

## Data Model

Suggested schema additions:

- `Polygon2Schema`
  - `points: Type.Array(Vector2Schema, { minItems: 3 })`

Suggested runtime types:

- `NavigationGrid`
  - `cellSize`
  - `origin`
  - `width`
  - `height`
  - `walkable`

- `GridCell`
  - `x`
  - `y`

Suggested editor draft shape:

- `walkAreaPoints: Array<{ x: string; y: string }>`

The editor should continue storing string drafts locally so validation stays aligned with the current inspector model.

## Navigation Behavior

### Pathfinding resolution

Use a fixed grid cell size for this milestone, chosen to keep the sample scene responsive without overfitting:

- recommended initial default: `24` scene units

This should be an internal constant for now, not a scene-authored field.

### Click handling

- clicks inside the polygon target the clicked location
- clicks outside the polygon target the nearest point on the walkable boundary
- if the nearest path cell cannot be resolved, movement safely no-ops

### Determinism

Neighbor ordering for A* should be fixed so equivalent searches remain deterministic across runs.

Recommended:

- 8-directional neighbors
- stable neighbor order
- Euclidean or octile heuristic

### Path output

The engine does not need to expose the whole path yet unless the renderer needs it immediately.

For this milestone:

- pathfinding resolves a valid destination
- the current immediate-position move behavior can remain

This keeps the blast radius smaller while still validating navigation logic. A later milestone can animate along the full path.

## Editor UI Design

### Inspector

Replace the walk area rectangle controls in the scene inspector with:

- ordered vertex cards
- `x` field
- `y` field
- remove button

Below the list:

- `Add vertex`
- `Apply changes`

### Scene preview

Show the walk polygon overlay in the editor preview.

Recommended rendering:

- dashed outline
- translucent fill
- vertex markers

This is primarily feedback for authoring and debugging.

### Recovery and undo behavior

Polygon vertex edits participate in the existing local draft history and autosave recovery exactly like other scene edits.

No separate history model is needed.

## Error Handling

- invalid polygons should be rejected on apply with a clear status message
- polygons with fewer than 3 points should never be persisted
- degenerate polygons with zero usable area should be rejected
- pathfinding failure should not crash the runtime
- malformed sample or project scene documents should continue failing through schema validation

For this milestone, self-intersection detection can be lightweight:

- require at least 3 points
- reject zero-area polygons
- accept that more advanced polygon validation can come later

## Testing

Add coverage for:

- schema validation of polygon walk areas
- geometry helpers:
  - point inside/outside
  - nearest boundary point
  - zero-area rejection
- pathfinding:
  - reachable target inside a concave polygon
  - target projection from outside to boundary
  - deterministic result on a fixed map
- `project-io` read/write for polygon scene updates
- editor scene draft handling for polygon point arrays where applicable

Verification pass:

- `pnpm test`
- `pnpm typecheck`
- `pnpm validate:sample`
- `pnpm --filter @pointclick/editor build`

## Implementation Notes

Suggested order:

1. add polygon schema and update scene contracts
2. update sample scene documents and validation tests
3. add runtime geometry and grid pathfinding helpers with tests
4. wire engine movement to the navigation helpers
5. update `project-io` scene patch shape
6. update editor scene drafts, inspector, and preview overlay
7. run full verification and package build

## Risks And Limits

- grid resolution that is too coarse can produce awkward path endpoints
- grid resolution that is too fine can waste runtime work
- immediate endpoint movement means pathfinding improves validity before it improves visible animation
- inspector-only polygon editing is functional but not yet delightful

These limits are acceptable for this milestone because the main objective is to establish correct data and runtime behavior first.

## Done Criteria

This step is complete when:

- layered-2d scenes define walkable space as polygons instead of rectangles
- sample content validates and runs with the new format
- layered-2d movement resolves against polygon navigation logic
- the editor can inspect and apply polygon walk area changes
- automated validation passes
