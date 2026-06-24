# Authoring Loop And AI Prompt Pack Design

Date: 2026-06-24
Status: Proposed

## Goal

Turn the editor into a viewport-first adventure authoring tool while adding a
bounded AI workflow for scene art direction.

The next meaningful direction is not a separate "AI game generator". The AI
surface should assist the authoring loop that already exists in the project:

```text
scene layout -> actors and props -> prompt pack -> provider job -> generated assets
-> human approval -> asset registry -> scene assignment -> runtime preview
```

The first milestone should make core scene elements directly editable in the
editor and introduce an AI Prompt Pack Studio that can propose coordinated
background, prop, character, and animation prompts from the current project
context.

## Scope

Included:

- viewport-first walk area editing
- viewport-first hotspot editing
- a new actor/prop scene model for visible interactive objects
- interaction spots and optional look spots for actors, props, pickups, and
  hotspots
- conditional prop visibility based on world flags
- runtime support for moving the player to an interaction spot before executing
  an action
- AI Prompt Pack Studio in the editor asset workflow
- provider adapter boundary with a mock provider first
- prompt pack persistence with provenance
- review and approval flow before generated or suggested content affects scene
  data

Excluded from the first implementation:

- direct integration with OpenAI, Replicate, ComfyUI, or ElevenLabs
- image inpainting, masking, chroma key cleanup, or sprite sheet extraction
- full character animation tooling or a character gym
- full graph-based flow authoring
- hybrid 3D runtime behavior
- cloud collaboration or multiplayer authoring

## Why This Shape

The current project already has the right foundation: Git-friendly project
documents, schemas, deterministic state, flows, inventory, a Pixi renderer, a
web player, an Electron editor, asset registry work, and beta visual scene
tools.

The gap is not another low-level runtime abstraction. The gap is the authoring
experience: a designer should be able to lay out a scene, define walkable space,
place interactive props, set the character's interaction target, and preview the
result without editing JSON manually.

AI should enter only where it strengthens that loop. A prompt pack is the right
first AI artifact because it is useful, reviewable, provider-independent, and
compatible with the existing asset library direction.

## Approaches Considered

### Option A: AI Asset Studio first

Build the AI generation UI and provider integration before improving the scene
authoring loop.

Rejected because generated content would land in an editor that cannot yet
comfortably turn assets into a playable scene.

### Option B: Editor authoring only

Finish all editor authoring surfaces before introducing AI.

Rejected because it delays the project's differentiator and loses the momentum
from the AI-assisted adventure production workflow.

### Option C: Authoring Loop plus Prompt Pack MVP

Improve the scene authoring loop and add a provider-independent Prompt Pack
Studio in the same milestone family.

Chosen because the two tracks reinforce each other. The editor gives AI useful
context, and AI produces structured suggestions that the editor can review,
place, and validate.

## Editor Experience

The scene editor should become mode-based and viewport-first.

### Walk Mode

Walk Mode edits the walkable polygon directly in the viewport.

Required behavior:

- show the walk area as a cyan polygon overlay
- drag polygon points
- insert a point on an edge
- remove a point while preserving a valid polygon
- show inline validation when the polygon is invalid, too small, or
  self-intersecting
- keep numeric inspector fields as a secondary precise-editing path

### Actors Mode

Actors Mode is the main object-placement mode. It is modeled after the supplied
editor reference image: labeled scene objects over the background, translucent
bounds, and draggable gizmos for interaction targets.

Required behavior:

- create a visible actor or prop from an asset or a temporary editor marker
- select actors and props from the viewport
- drag the actor or prop bounds
- resize bounds
- edit depth
- drag `interactSpot`
- optionally enable and drag `lookSpot`
- display labels such as `actor: screwdriver`
- show actor health: ready, missing asset, missing locale, missing action, or
  invalid spot
- expose detailed fields in the inspector without making the inspector the
  primary workflow

Actors and props are broader than current pickups. A prop can be decorative,
interactive, collectible, an NPC draft marker, an exit marker, or a stateful
overlay.

### Hotspots Mode

Hotspots Mode edits invisible or semi-visible interaction areas without requiring
a visible asset.

Required behavior:

- create standalone rectangular hotspots
- drag and resize hotspot bounds
- assign verb actions, item-specific actions, and flow references
- add `interactSpot`
- optionally add `lookSpot`
- use validation badges for missing flow, item, or locale references

Standalone hotspots remain useful for doors, exits, large zones, signs,
background details, and trigger areas.

### Preview Mode

Preview Mode tests the scene without leaving the editor context.

Required behavior:

- click to walk
- click actor, prop, pickup, or hotspot
- use current verb and selected inventory item
- move the player to the interaction spot before resolving the action when one
  exists
- apply flow, flag, inventory, pickup, and visibility updates
- surface recent runtime events and current flags for debugging

Preview can continue using the existing isolated player path, but the editor
should make the transition feel immediate.

## Data Model

### Scene actor

Add a new scene object for visible interactive or stateful objects.

Proposed shape:

```ts
interface SceneActor {
  id: string;
  role: "prop" | "pickup" | "npc" | "exit" | "decoration";
  labelKey: string;
  assetId?: string;
  bounds: Rect;
  depth: number;
  visibleWhen?: ConditionExpression;
  interactSpot?: Vector2;
  lookSpot?: Vector2;
  actions: HotspotActions;
}
```

The name `SceneActor` is intentionally broad. In editor language this may appear
as "Actors Mode" or "Props", but the data model needs one concept that can cover
visible interactive objects and stateful overlays.

### Standalone hotspot

Extend existing hotspots with optional target spots.

Proposed additions:

```ts
interface Hotspot {
  interactSpot?: Vector2;
  lookSpot?: Vector2;
}
```

### Conditions

The first condition model should be small and serializable.

Proposed shape:

```ts
type ConditionExpression =
  | { type: "flag-equals"; key: string; value: string | number | boolean }
  | { type: "item-in-inventory"; itemId: string };
```

This is enough for conditional props such as open drawers, removed objects, and
state-specific overlays without committing to a full scripting language.

### Prompt pack

Add a project document for AI prompt packs.

Proposed shape:

```ts
interface PromptPackDocument {
  schemaVersion: 1;
  id: string;
  name: string;
  sceneId: string;
  artBrief: string;
  context: PromptPackContext;
  outputs: PromptPackOutputs;
  suggestedActors: PromptPackSuggestedActor[];
  provenance: PromptPackProvenance;
}
```

Prompt pack outputs:

- scene background prompt
- prop or overlay prompts
- character reference prompts
- animation notes prepared for a later image-to-video workflow
- negative prompt
- style notes
- generation targets such as aspect ratio, dimensions, transparency, and
  intended use

Suggested actor metadata:

```ts
interface PromptPackSuggestedActor {
  id: string;
  role: SceneActor["role"];
  label: string;
  visualPrompt: string;
  suggestedBounds?: Rect;
  suggestedInteractSpot?: Vector2;
  suggestedLookSpot?: Vector2;
}
```

Suggested actors must be review-only until the user explicitly applies them.

## Runtime Behavior

The runtime should continue treating serializable state as the source of truth.
Renderer objects are never stored in saves or project documents.

Interaction resolution should become:

1. resolve the clicked target
2. resolve verb and selected item
3. if the target has `interactSpot`, move the player there using the walk-area
   resolver
4. dispatch the interaction command
5. start the resolved flow if available
6. apply commands emitted by the flow
7. update conditional actor visibility from world state

For the first implementation, movement can remain instantaneous. The important
behavior is that the authoritative player position becomes the target
interaction spot before the action resolves.

## AI Provider Boundary

Introduce a provider-independent generation interface before any real external
API integration.

Proposed flow:

```text
GeneratePromptPackRequest -> ProviderJob -> PromptPackCandidate[] -> review
-> approve -> PromptPackDocument
```

Provider responsibilities:

- accept normalized scene context and art brief
- return one or more candidates
- include provenance metadata
- avoid writing project files directly

The first provider should be a mock provider. It should produce deterministic
candidate prompt packs from the input context so the editor workflow, persistence
model, review flow, and tests can be completed without network access or vendor
lock-in.

## Prompt Pack Context

The Prompt Pack Studio should derive context from the project instead of asking
the user to repeat information manually.

Context should include:

- project title
- selected scene id, name, dimensions, and background
- current walk area summary
- hotspots and actions
- actors, props, pickups, and their labels
- inventory items
- related flow ids and dialogue keys
- default locale strings for visible labels
- user art brief
- no style bible fields in the first implementation

The style bible is explicitly outside the first implementation. This slice uses
scene context plus a freeform art brief.

## Persistence And File Layout

Prompt packs should be normal project documents referenced from the manifest.

Recommended layout:

```text
prompt-packs/<id>.prompt-pack.json
```

The manifest can add:

```ts
promptPacks: Array<{ id: string; path: string }>
```

Generated image assets remain separate asset documents in the existing asset
registry. A prompt pack can reference generated assets after approval, but it
should not replace the asset registry as the owner of imported files.

## Validation Rules

Validation should cover:

- actor ids are unique within a scene
- actor asset ids exist when present
- actor locale keys exist in the default locale as warnings
- actor bounds have positive size
- actor interaction spots are inside or near the walk area
- actor actions reference existing flows and items
- hotspot spots are valid scene points
- conditional visibility references valid item ids where applicable
- prompt packs reference existing scenes
- prompt pack suggested actor ids are valid ids
- provider provenance exists for generated prompt packs

## Error Handling

Missing actor assets should not crash the editor or runtime. The editor should
show the actor as broken and the runtime should fall back to visible debug
bounds or omit the visual while preserving interactions where possible.

Invalid interaction spots should block preview readiness for that target because
the player cannot reliably move to the object.

Provider failures should create no project mutations. The Prompt Pack Studio
should keep the user's art brief and show the failure.

Applying suggested actors should be explicit and reversible through the existing
editor draft and undo model.

## Testing

Add focused coverage for:

- contract validation for scene actors
- contract validation for hotspot interaction spots
- condition expression validation
- prompt pack document validation
- project loading for prompt packs
- runtime movement to interaction spot before action resolution
- conditional actor visibility from flags
- editor session updates for actor bounds, interaction spot, look spot, and
  depth
- mock prompt provider output determinism
- prompt pack persistence and reload

Verification pass:

- `pnpm test`
- `pnpm typecheck`
- `pnpm validate:sample`
- `pnpm build`

## Implementation Sequence

1. Add scene actor, interaction spot, condition, and prompt pack schemas.
2. Extend project loading and validation for prompt packs and scene actors.
3. Extend runtime target resolution for actor interactions and interaction
   spots.
4. Add actor visibility evaluation from world state.
5. Add editor session support for actor drafts and undo/redo.
6. Build viewport Actors Mode for bounds, depth, interact spot, and look spot.
7. Tighten Walk Mode and Hotspots Mode around the same viewport interaction
   model.
8. Add Prompt Pack Studio with mock provider and review-only candidates.
9. Persist approved prompt packs as project documents.
10. Add tests and run verification.

## Risks And Limits

- The word "actor" can be confused with animated characters. The editor can
  label the mode "Actors" while the docs explain that actors include props,
  pickups, NPC draft markers, exits, and overlays.
- Adding scene actors overlaps with pickups. The first implementation should
  either migrate pickups gradually or keep pickups as a specialized target until
  actor behavior is stable.
- Prompt packs can become too broad. The first provider should generate
  structured prompts and suggested metadata only, not mutate scene files.
- Real provider APIs will introduce authentication, cost, rate limits, and
  content policy handling. The mock provider intentionally keeps those outside
  this design slice.

## Done Criteria

This design is complete when:

- a user can edit walk areas, hotspots, actors, props, and interaction spots
  primarily in the viewport
- visible props or actors can be positioned, depth-ordered, validated, and
  previewed
- runtime interactions move the player to an interaction spot before resolving
  actions
- prompt packs can be generated through a mock provider from selected scene
  context and an art brief
- prompt packs can be reviewed and saved with provenance
- suggested actors remain review-only until explicitly applied
- automated checks pass
