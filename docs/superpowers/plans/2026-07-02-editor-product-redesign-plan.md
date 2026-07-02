# Editor Product Redesign Implementation Plan

Source spec:
`docs/superpowers/specs/2026-07-02-editor-product-redesign-design.md`

## Phase 0: Commit Hygiene For Pending Work

Goal: preserve real product changes already present in the working tree while
excluding generated or project-specific outputs that should not be committed by
default.

1. Capture the current working tree.
   - Run `git status --short`.
   - Run `git diff --stat`.
   - Identify untracked directories separately from tracked modifications.

2. Classify changes into commit groups.
   - Editor product/source changes:
     `apps/editor/src/**`, `apps/editor/package.json`.
   - Player/runtime-facing changes:
     `apps/player-web/**`, relevant package changes.
   - Project IO and validation changes:
     `packages/project-io/**`, contract-adjacent tests if present.
   - Documentation/release material:
     `README.md`, `docs/**`.
   - Test additions:
     `*.test.ts`, `tests/e2e/**`.
   - Generated or project-specific candidates requiring explicit approval:
     `apps/starter-game/project/assets/`,
     `apps/starter-game/project/generation-recipes/`,
     `apps/starter-game/project/prompt-packs/`,
     `apps/starter-game/project/workflow-templates/`,
     `apps/starter-game/project/workflows/`,
     imported media files, and any sample/starter output that is not intended
     as maintained source.

3. Inspect each group before staging.
   - Use focused diffs for tracked files.
   - Use file listings and representative content reads for untracked folders.
   - Do not stage uncertain generated output.
   - Do not revert user changes.

4. Commit in small, reviewable batches.
   - Commit editor/product source separately from docs and generated content.
   - Include tests with the code they validate when the relationship is clear.
   - Leave excluded generated/project-specific files unstaged.

5. Verify the post-commit state.
   - Run `git status --short`.
   - Report any remaining unstaged/untracked paths and why they remain.

Done when all intentional product changes are committed and only intentionally
excluded generated/project-specific outputs remain.

## Phase 1: Information Architecture

Goal: define the editor as a project-first product shell with clear workspace
ownership.

1. Audit current workspace state.
   - Locate `Workspace` type and current workspace capability definitions.
   - Map current Overview, Scene, Narrative, Assets, AI, and Build UI surfaces.
   - Note controls that are shown outside their useful context.

2. Define workspace model.
   - Rename or reframe Overview as Project.
   - Keep six primary workspaces: Project, Scenes, Narrative, Assets, AI Studio,
     Build.
   - Add a structured navigation target shape for cross-workspace jumps.

3. Refactor shell boundaries.
   - Extract shell-level topbar, workspace tabs, status strip, and shared panel
     primitives where needed.
   - Keep workspace-specific controls out of the global shell.

4. Verification.
   - Unit-test workspace target helpers.
   - Smoke-test that non-scene workspaces do not show scene tools.

Done when workspace responsibilities are represented in code and irrelevant
global controls are removed.

## Phase 2: Shell And Project Workspace

Goal: replace passive Overview with an actionable Project control room.

1. Topbar redesign.
   - Consolidate Open, Blank, and Starter into one Project menu when a project
     is loaded.
   - Keep undo/redo, validation/preview status, and Play/Preview compact.
   - Keep the no-project screen explicit with large create/open actions.

2. Project workspace data model.
   - Derive counts for scenes, assets, flows, items, locales, prompt packs, and
     diagnostics.
   - Derive project metadata fields from the manifest.
   - Add editable fields for optional logo, intro/cutscene, default locale, and
     initial scene only where the data model can support draft values safely.

3. Actionable cards and rows.
   - Scene count opens Scenes.
   - Asset count opens Assets.
   - Diagnostics opens Build.
   - Missing narrative links open Narrative when target information exists.

4. Verification.
   - Unit-test summary count derivation.
   - Add a Playwright path from Project summary to Scenes and Build.

Done when Project can navigate the whole game and edit or expose core project
settings without duplicating Build.

## Phase 3: Scenes Workspace

Goal: make scene authoring organized around a scene-local hierarchy and
selection-driven editing.

1. Scene tree.
   - Build a sidebar tree grouped by scene.
   - Under each scene show Background, Layers, Walk area, Player start, Actors,
     Pickups, Hotspots, and Guides / AI masks.
   - Add create actions at the relevant tree level.

2. Selection model.
   - Introduce a scene selection target with kind and id.
   - Sync tree selection to viewport selection.
   - Sync viewport clicks to tree and inspector selection.

3. Contextual tools.
   - Show scene tools only inside Scenes.
   - Default to Select.
   - Keep creation tools compact.
   - Show transform actions such as move, resize, scale, rotate, lock, and
     visibility only when applicable.
   - Auto-select newly created objects.

4. Inspector states.
   - Separate inspector sections for scene, layer, actor, pickup, hotspot,
     player start, walk area, and generation guide.
   - Show missing asset/flow diagnostics inline.

5. Verification.
   - Unit-test scene tree model creation.
   - Add interaction coverage for selecting a tree node and selecting a viewport
     object.
   - Run editor typecheck/build.

Done when a scene can be understood and edited from the tree, viewport, and
inspector as one synchronized surface.

## Phase 4: Narrative Workspace

Goal: make narrative read as game behavior linked to scenes and entities.

1. Relationship index.
   - Build an index from scenes to hotspots, actors, pickups, items, and their
     linked flows.
   - Include reverse lookup from flow to referring entities.

2. Narrative navigation.
   - Group flows by scene/entity relationship.
   - Keep an all-flows view for unlinked or global flows.
   - Add jump actions back to the triggering scene entity.

3. Locale integration.
   - Show text keys in the context of flow lines.
   - Surface missing locale keys inline.
   - Keep raw locale editing available but secondary.

4. Verification.
   - Unit-test relationship index generation.
   - Add coverage for jumping from a hotspot to its flow and back.

Done when Narrative explains what happens in the game and how it is triggered.

## Phase 5: AI Studio

Goal: convert AI from provider-first controls into a target-based workflow.

1. Target selection.
   - Define generation target contexts for scene background, actor, pickup,
     player, asset variation, guide, and mask.
   - Allow opening AI Studio with a preselected target from Scenes or Assets.

2. Guided workflow.
   - Implement steps: Brief, Context, Recipe, Generate, Review & Apply,
     Provenance.
   - Keep provider setup inside Recipe and diagnostics.
   - Preserve deterministic mock generation as the default test path.

3. Review and apply.
   - Show generated outputs with warnings.
   - Import accepted output as a normal asset.
   - Assign accepted asset to the selected target when applicable.
   - Link to Asset Studio for crop, chroma, guide cleanup, or animation slicing.

4. Provenance.
   - Display prompt, negative prompt, seed, model, provider, workflow id,
     recipe id, target id, dimensions, references, masks, guide ids, warnings,
     and parent asset lineage.

5. Verification.
   - Unit-test target context derivation.
   - Mock provider-dependent generation tests.
   - Add an integration path from scene target to AI output review and asset
     assignment where feasible.

Done when the creator starts from "what should I create for this game?" and can
apply the result without provider knowledge.

## Phase 6: Build And Readiness

Goal: make Build the authoritative readiness and diagnostic workspace.

1. Diagnostic targets.
   - Map diagnostics to structured workspace targets whenever possible.
   - Add fallback display for diagnostics that cannot be linked.

2. Readiness clarity.
   - Distinguish saved-project validation from draft preview state.
   - Show blocking errors, warnings, and draft mismatches separately.

3. Action checklist.
   - Add actions that open the exact Project, Scenes, Narrative, Assets, or AI
     target.
   - Keep Project settings out of Build except as navigation targets.

4. Verification.
   - Unit-test diagnostic-to-target mapping.
   - Add Playwright coverage for opening an issue from Build and landing on the
     source object.

Done when validation issues are explainable and actionable from one place.

## Phase 7: Final Verification

Goal: make the redesign stable enough for continued product work.

1. Run static and automated checks.
   - `pnpm build`
   - `pnpm test`
   - Existing Playwright suite where practical.

2. Manual editor smoke test.
   - Open or create a project.
   - Navigate Project, Scenes, Narrative, Assets, AI Studio, and Build.
   - Select a scene entity.
   - Jump from entity to narrative and back.
   - Run validation.
   - Preview the project.

3. Documentation update.
   - Update README or authoring docs only where the user-facing workflow has
     changed.
   - Keep release notes aligned with implemented behavior.

4. Final commit grouping.
   - Commit implementation by coherent phase where possible.
   - Leave generated project outputs unstaged unless approved.

Done when checks pass or failures are documented, the UI paths are manually
verified, and commits are organized by product intent.
