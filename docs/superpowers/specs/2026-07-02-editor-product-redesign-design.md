# Editor Product Redesign Design

## Context

Point & Click Studio already has the core pieces for a creator-facing editor:
project open/create flows, scene authoring, narrative documents, asset import,
validation, preview, prompt packs, and local AI image generation. The current
experience still feels like a set of technical panels. Important controls are
duplicated, scene tools appear outside their useful context, overview elements
are not actionable, narrative feels detached from scene entities, and AI
generation exposes provider mechanics before creator intent.

This redesign treats the editor as a project-first game creation workspace. A
project is the center of the product; scenes, narrative, assets, AI, and build
are peer workspaces with clear ownership and explicit links between them.

## Goals

- Make the top-level shell compact, coherent, and free of duplicate project
  actions.
- Turn Overview into a real Project workspace with actionable project status,
  settings, and entrypoints.
- Make Scenes own all scene-local entities through a clear hierarchy: layers,
  walk area, player start, actors, pickups, hotspots, and generation guides.
- Replace the current always-visible tool palette with contextual, compact,
  smarter scene editing controls.
- Make Narrative understandable as game logic connected to scenes and entities,
  not as detached flow and locale documents.
- Convert AI into a target-based studio workflow: brief, context, recipe,
  generate, review, apply, and provenance.
- Keep Build as the authoritative validation and preview readiness workspace.
- Add repository hygiene to the delivery plan so pending product changes are
  committed intentionally while excluding project-specific generated assets,
  imports, and starter-project output when they are not product source.

## Non-Goals

- Replacing the existing project document format in this redesign phase.
- Removing optional local providers such as ComfyUI, LM Studio, or OpenAI.
- Building a fully guided linear wizard as the primary editor model.
- Shipping hosted collaboration, mobile export, runtime LLM behavior, or a
  public marketing site as part of this redesign.

## Product Architecture

The editor shell should expose six primary workspaces:

- Project
- Scenes
- Narrative
- Assets
- AI Studio
- Build

Each workspace uses the same structural model:

- A global topbar for project identity, workspace navigation, and global
  actions.
- A left contextual sidebar for navigation inside the active workspace.
- A main stage for the primary authoring surface.
- A right inspector for the selected object or workflow step.
- A compact bottom status strip for global state that remains useful across
  workspaces.

The topbar should not become a dumping ground for every action. Project
creation and opening live behind one compact Project menu after a project is
loaded, while the no-project start screen can keep large explicit actions for
blank, starter, and open.

## Project Workspace

The current Overview becomes Project. It should be interactive and should act
as the game's control room.

Project must include:

- General metadata: game name, project id or slug, optional logo, default
  locale, and viewport.
- Game entrypoints: initial scene, optional intro or cutscene hooks, player
  defaults, and preview target.
- Project structure: scenes, assets, flows, items, locales, prompt packs, and
  diagnostics.
- Health checklist: validation status, draft state, missing references, and
  preview readiness.

Every summary row must be actionable. Scene count opens Scenes. Asset count
opens Assets. Diagnostics opens Build. Missing narrative links open Narrative
with the relevant target selected. This replaces passive status cards with
navigation affordances.

## Scenes Workspace

Scenes is responsible for scene-local composition and entity placement. The
left sidebar should become a real scene tree:

```text
Scenes
  Scene Name
    Background
    Layers
    Walk area
    Player start
    Actors
      Actor
    Pickups
      Pickup
    Hotspots
      Hotspot
    Guides / AI masks
```

Creation should happen at the correct tree level. Selecting a scene-level item
updates the stage selection and inspector. Selecting an entity in the viewport
selects the same entity in the tree.

The visual editor should default to selection and make tool state easier to
understand:

- Scene tools appear only in Scenes.
- The default tool is Select.
- Creation tools are compact and contextual: hotspot, actor, pickup, walk area,
  layer, and guide.
- Transform actions appear when an applicable object is selected: move, resize,
  scale, rotate, and lock or visibility where supported.
- After creating an object, the editor selects it and switches into its most
  likely edit mode.
- The inspector should show only controls that apply to the current selection.

This keeps scene authoring direct while reducing the cognitive load of choosing
the correct tool first.

## Narrative Workspace

Narrative should explain how the game behaves. It should group and filter flows
by relationship instead of only listing documents.

Narrative should support:

- Scene-linked flow groups.
- Hotspot actions and actor dialogue links.
- Item pickup and item-use flows.
- Locale text editing inside the context of a flow or line.
- Diagnostics such as missing text keys, unlinked hotspots, actors without
  dialogue, and broken flow references.

The user should be able to start from either direction: open an entity from a
scene to edit its narrative behavior, or open a flow and jump back to the scene
entities that trigger it.

## Assets Workspace

Assets remains the library and preparation area. It should focus on imported
and generated assets, usage, cleanup, animation packs, and assignment.

Asset details should show:

- Where the asset is used.
- Whether the file exists and matches project expectations.
- Available preparation tools such as chroma key, crop, guide cleanup, and
  animation slicing.
- Assignment shortcuts to selected scene entities when applicable.

Asset Studio should remain separate from AI Studio. AI creates or proposes
assets; Assets prepares, inspects, and assigns them.

## AI Studio

AI Studio should be target-based. The creator starts with the game thing they
want, not the provider.

The workflow is:

1. Brief: choose the target, such as scene background, actor, pickup, player,
   style reference, guide mask, or variation.
2. Context: collect scene, style bible, reference assets, masks, generation
   guides, dimensions, and intended use.
3. Recipe: choose an approved workflow or provider recipe with visible limits,
   hardware expectations, and output mode.
4. Generate: run or mock the job, show queue status, errors, timeout, and
   output location.
5. Review & Apply: compare outputs, clean up when needed, import as an asset,
   and assign to the selected target.
6. Provenance: show prompt, negative prompt, seed, model, workflow id, recipe
   id, target id, dimensions, references, masks, guide ids, warnings, and
   parent asset lineage.

Provider configuration belongs inside recipe setup and diagnostics. The main
AI experience should communicate what will be created, why it fits the project,
and what will happen when the output is accepted.

## Build Workspace

Build remains the validation and readiness workspace. It should become the
source of truth for whether the saved project can be previewed or shipped.

Build should include:

- Saved-project validation.
- Draft-vs-saved mismatch warnings.
- Preview readiness.
- Export or package readiness when available.
- Actionable diagnostics that open the exact workspace and object.

Build should not duplicate Project settings. It reports and fixes readiness,
while Project owns game metadata and configuration.

## Repository Hygiene Plan

Before implementation work begins, pending changes should be classified and
committed intentionally. The current working tree contains broad product changes
in editor, player, docs, project IO, tests, packages, and lockfile, plus
project-specific starter-game generated folders.

The commit pass should:

- Inspect `git status --short` and `git diff --stat`.
- Group product changes by purpose, such as editor UX, AI workflow support,
  player/runtime support, documentation, and tests.
- Commit real source, tests, docs, package, and lockfile changes that belong to
  the product.
- Exclude generated or project-specific output unless it is intentionally part
  of starter/sample source. Examples requiring extra scrutiny are
  `apps/starter-game/project/assets/`, `generation-recipes/`, `prompt-packs/`,
  `workflow-templates/`, `workflows/`, and imported asset files.
- Avoid mixing unrelated generated assets with product code.
- Leave unrelated or uncertain files unstaged rather than silently committing
  them.

This phase is not a cleanup-by-revert task. Existing changes must be preserved
unless the user explicitly asks to remove them.

## Delivery Phases

### Phase 1: Information Architecture

- Rename or reframe Overview as Project.
- Define workspace ownership and navigation rules.
- Decide which controls belong to topbar, sidebar, stage, inspector, and status
  strip.
- Remove scene-only tools from non-scene workspaces.

Done when the editor has a clear workspace map and no top-level area exposes
irrelevant controls.

### Phase 2: Shell And Project Workspace

- Compact the topbar.
- Consolidate new/open/starter actions into one Project menu for loaded
  projects.
- Keep the no-project screen explicit and beginner-friendly.
- Add Project settings and actionable project summary cards.

Done when the user can understand and navigate the whole game from Project.

### Phase 3: Scenes Workspace

- Build the scene hierarchy sidebar.
- Sync tree selection with viewport selection.
- Add contextual creation and transform controls.
- Refine inspector states for scene, layer, actor, pickup, hotspot, player
  start, walk area, and guide selections.

Done when scene composition can be edited from a coherent scene tree and a
contextual viewport.

### Phase 4: Narrative Workspace

- Group flows by scene and entity relation.
- Add bidirectional navigation between narrative flows and scene entities.
- Surface missing links and missing locale keys inline.
- Keep locale editing contextual to narrative content.

Done when narrative structure reads like game behavior instead of document
storage.

### Phase 5: AI Studio

- Redesign AI around target selection and recipes.
- Make provider selection secondary to the target and recipe.
- Add guided review and apply flow.
- Make provenance inspectable after import and assignment.

Done when a creator can generate an asset for a specific game target and apply
it without understanding provider internals first.

### Phase 6: Build And Release Readiness

- Make diagnostics fully actionable.
- Clarify saved validation versus draft preview.
- Add readiness signals for preview and future export.
- Use Build as the final release gate for the editor workflow.

Done when project health issues are discoverable, explainable, and fixable from
the UI.

## Data Flow

The redesign should keep existing serializable project documents as the source
of truth. UI state can add selection, filters, active workspace, expanded tree
nodes, and draft state, but runtime and saved project contracts remain owned by
the packages that already define them.

Cross-workspace navigation should pass structured targets rather than raw UI
strings, for example:

- workspace: `scenes`, target: scene id plus entity kind and id
- workspace: `narrative`, target: flow id or text key
- workspace: `assets`, target: asset id
- workspace: `build`, target: diagnostic id
- workspace: `ai`, target: generation target context

This keeps the workspaces decoupled while making them feel connected.

## Error Handling And Empty States

- If no project is loaded, show the start screen and suppress workspace tools.
- If a project has no scenes, Project and Scenes should offer scene creation.
- If an entity references missing assets or flows, show inline diagnostics in
  the inspector and link to the fix.
- If an AI provider is unavailable, AI Studio should still support mock or
  draft recipes and clearly label provider setup as unavailable.
- If validation reflects saved files while drafts exist, Build must explain the
  mismatch and offer the relevant save/apply path.

## Testing Strategy

- Unit-test navigation target helpers and workspace selection behavior.
- Unit-test project summary counts and diagnostic-to-target mapping.
- Component-test or integration-test scene tree selection and viewport
  selection synchronization.
- Add Playwright coverage for the main happy paths: open project, navigate
  Project to Scenes, select a scene entity, jump to Narrative, run validation,
  and return from a diagnostic to the source object.
- Keep provider-dependent AI tests mocked by default.

## Risks

- The current UI is concentrated in large files. Implementation should avoid
  further growth by extracting focused shell, scene tree, project workspace,
  narrative, AI workflow, and build components.
- A full redesign can expand scope quickly. Each phase needs a concrete done
  condition and should remain shippable.
- AI Studio can become provider-driven again if recipes are not modeled as
  creator-facing targets.
- Repository hygiene can accidentally commit generated starter-game artifacts.
  The commit pass must inspect file purpose before staging.

## Acceptance Criteria

- Topbar project actions are compact and no longer duplicated across always-on
  controls.
- Overview is replaced or reframed as an actionable Project workspace.
- Scene tools do not appear in non-scene workspaces.
- Scenes has a hierarchy that groups scene-local layers, walk area, player,
  actors, pickups, hotspots, and guides under each scene.
- Scene creation and editing use contextual tool behavior and selection-driven
  inspectors.
- Narrative can be navigated by scene/entity relationship and exposes missing
  links.
- AI Studio starts from a target and guides the user through recipe, generation,
  review, apply, and provenance.
- Build diagnostics open the correct workspace and object.
- Pending working-tree changes are classified before implementation commits,
  and project-specific generated outputs are excluded unless intentionally
  approved.
