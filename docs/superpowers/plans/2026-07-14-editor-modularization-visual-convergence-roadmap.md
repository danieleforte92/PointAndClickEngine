# Editor Modularization and Visual Convergence Roadmap

Status: Wave A launchpad merged; feature completion next (PR-03 foundation, PR-04 core seams, the first AI/Scenes/Assets structural tranche, and the integrator-owned launchpad are integrated in `develop`)
Base: `develop` at `6a1d2ec` (alpha.3 source preparation)
Current HEAD: `47f1564` (PR-23 launchpad merged after PR-20 consolidation and PR-21 CI/provenance follow-up)
Date: 2026-07-15

## Current implementation checkpoint

- Characterization E2E and editor budget checks are active.
- `@pointclick/ui-theme` now exposes scoped `studio.css`, `player.css`, and
  `theme-contract.css` entry points; the player remains on the legacy palette.
- The editor stylesheet has an ordered entrypoint, a reset partial, and a
  semantic shell/theme partial. Topbar and project/build surfaces now consume
  the contract tokens.
- Pure editor lookup, asset, validation, selection, and provider-boundary
  helpers live in `apps/editor/src/editor-ui-model.ts`, covered by focused unit
  tests. Workspace stage-toolbar decisions now live in
  `apps/editor/src/editor-workspace-model.ts` with focused tests. The shared
  async error-to-status policy now lives in
  `apps/editor/src/editor-status-policy.ts` and all 55 editor error paths now
  use the shared formatter, including the 12 feature-local asset, validation,
  export, and cleanup paths. The typed
  project/session controller now composes the command bus,
  project hydration, recovery, stable resource selection, and draft cleanup
  seams. `editor-feature-controller.ts` now owns the injectable boundary for
  preview, import/processing, AI generation, candidate handoff, validation,
  and export operations. AI Studio owns its workflow reducer and extracted
  stepper shell; Scenes and Assets now have matching feature-local reducers,
  workspace boundaries, and integrator-owned typed launchpads. The monolith is
  currently 13,043 lines; `editor.css` is 3,431 lines with 434 literal color
  occurrences. The remaining feature markup and orchestration still lives in
  `EditorApp` and is now the scope of the completion workstreams.
- Scene/document defaults, ID allocation, viewport guardrails, and layer
  validation now live in `apps/editor/src/editor-authoring-model.ts` with
  focused tests. The final provider-config breakpoint is isolated in
  `editor-responsive.css`, loaded after the base and theme layers.
- Scene, Asset Studio, AI Studio, Inspector, diagnostics, and status surfaces
  now consume the same semantic tokens through a late scoped feature layer;
  scene artwork remains intentionally warm and unchanged.
- Authoring mutations now pass through an injectable `EditorCommandBus` seam;
  project manifest hydration and overview draft reset now live in
  `apps/editor/src/editor-project-session.ts` with focused tests. Initial
  project/recovery loading, recovery persistence, reconciliation, and status
  policy now use the same controller/adapter seams without changing the public
  gateway contract.
- The implementation gates are green locally: 55 Vitest files / 315 tests,
  1 skip, 13 Playwright tests, workspace typecheck, sample/starter validation,
  theme contract, documentation check, budget check, and the packaged editor
  build.

## Consolidated delivery checkpoint

- The consolidation is merged into `develop` as PR-20, with the CI/provenance
  repair shipped first as the stacked PR-21. The original PR-03/04 and
  PR-05/06/07 packaging remains as workstream labels, not retroactive review
  branches.
- PR-04 core seams are complete: command execution, session/recovery adapters,
  selection reconciliation, draft cleanup, shared status policy, and feature
  operations sit behind typed controller boundaries.
- The AI/Scenes/Assets wave is a structural tranche, not final feature closure:
  the stepper, tree, viewport, preview, crop/chroma/optimize panels, reducers,
  and CSS slices are extracted, while dialogs, inspectors, and remaining
  feature orchestration still need local ownership.
- `EditorGateway`, navigation targets, `packages/contracts`, and the project
  schema remain unchanged. The shared handoff contract now has an explicit
  `ui/shared` ownership boundary with compatibility re-exports.
- The release-evidence gap is closed: the editor baseline PNGs are covered by
  the provenance inventory, the dependency audit uses npm's bulk advisory
  endpoint, and the post-merge CI/CodeQL gates pass on `develop`.
- The baseline-neutral Wave A launchpad is merged as PR-23. `EditorApp` now
  supplies explicit `model` and `actions` groups to the Scenes tree/viewport
  and Asset Studio surfaces; AI Studio retains its existing typed workflow
  boundary. The PR-23 CI and CodeQL gates pass on `develop`.

## Next execution sequence

1. Keep the merged consolidation and launchpad evidence current in the
   roadmap checklist and PR history.
2. Start three feature worktrees in parallel: AI completion, Scenes completion,
   and Assets completion. Shared-owned files remain integrator-only.
3. After Wave A completion, repeat the serial launchpad for Narrative,
   Shell/Project/Build, and Test Lab/player feedback, then start their three
   parallel feature branches.
4. Reserve intentional visual tuning, compatibility removal, and final budget
   ratchets for PR-11.

## Shared launchpad and multi-agent ownership

- The coordinator owns `EditorApp`, root style imports, `editor.css`, shared
  contracts, E2E fixtures, manifests, and final integration.
- AI, Scenes, and Assets agents own only their respective `features/<name>/**`,
  feature styles, and focused specs after the launchpad merge.
- A contract gap is a small prerequisite change owned by the coordinator; no
  feature agent edits shared files opportunistically.
- The Wave A launchpad is merged; each completion branch now uses its own Git
  worktree, targets `develop`, opens as draft, and is rebased after each sibling
  merge.
- Structural waves preserve the current screenshots. Feature stylesheet files
  remain at or below 800 lines; split a feature stylesheet before adding a
  second large responsibility.

## Purpose

This roadmap turns the current editor into a modular, reviewable application and
brings its visual language closer to the supplied redesign mockups. It is an
engineering initiative inside the v0.4 line, not a new gameplay or project
schema milestone.

Mockup 4 is the primary color and semantic reference. Mockups 2 and 3 are the
reference for density, hierarchy, and legibility. The target is a compact
technical studio, not the surrounding marketing/dashboard composition shown in
the mockups.

## Starting baseline (historical)

| Area | Current evidence | Consequence |
|---|---:|---|
| `ui/editor-app.tsx` | 14,399 physical lines at roadmap creation; the `EditorApp` component remains the primary hotspot | Primary architecture and merge-conflict hotspot |
| React state in `EditorApp` | More than 120 local state declarations, 25 effects, and about 60 async handlers | Feature behavior has no practical ownership boundary |
| Gateway use | About 63 gateway calls, including 31 `applyCommand` calls | Persistence and UI reconciliation are repeated across features |
| `ui/editor.css` | 5,286 physical lines and 650 literal color occurrences at roadmap creation | Cascade, color semantics, and feature ownership are unclear |
| Late CSS overrides | A second editor skin starts around line 3,658; selectors such as `.scene-viewport` are defined in multiple layers | Visual changes are difficult to predict and review |
| `ui/editor-shell.tsx` | 1,196 lines covering shell, Project, Build, Assets, and timeline UI | The extracted shell is itself becoming a second monolith |
| UI tests | Feature E2E specs exist, but `apps/editor/src/ui/**` is excluded from Vitest coverage | Refactoring depends on fragile end-to-end selectors and has no visual gate |
| Shared theme | `@pointclick/ui-theme/storyboard.css` is imported by both editor and player | A global palette replacement could unintentionally recolor the player |

The current clean baseline passes `pnpm test`, `pnpm typecheck`,
`pnpm validate:sample`, and `pnpm validate:starter`. Build, packaged smoke, and
the complete E2E suite remain mandatory PR/CI gates.

## Target outcomes

- `EditorApp` becomes a composition root and workspace router instead of a
  feature implementation.
- Project session, navigation, preview, and feature-local state have explicit
  controllers and pure selectors.
- Scene, Narrative, Assets, AI, Build, Project, and Test Lab own their markup,
  controller, styles, and focused tests.
- Presentation components do not call `EditorGateway` directly.
- Sibling features communicate through typed navigation and handoff contracts,
  not through imports of one another's internals.
- The editor uses one scoped, semantic dark-studio theme. The player changes
  only in its explicitly scheduled PR.
- Pull requests are small enough to review by behavior, with deterministic
  screenshots and a ratcheting file-size/color budget.

## Non-goals

- Project schema or gameplay contract changes.
- New AI providers or generation workflows.
- Replacing the existing navigation target or injectable gateway seams.
- Adopting a global state library before reducers, controllers, and context
  boundaries have been proven insufficient.
- Rebuilding the player layout or changing gameplay behavior.

## Visual direction

The visual direction is a nocturnal technical studio: cool deep-navy chrome
frames the warmer game artwork, violet identifies brand and primary selection,
and semantic colors retain one stable meaning across editor, graph, Test Lab,
and player feedback.

### Provisional semantic tokens

These values are the starting point for the theme-contract PR. They must pass
contrast checks before the token contract is frozen.

| Role | Token | Initial value |
|---|---|---:|
| Outer canvas | `--pc-bg-canvas` | `#070B14` |
| Application shell | `--pc-bg-app` | `#0A1020` |
| Panel | `--pc-bg-panel` | `#101827` |
| Raised panel | `--pc-bg-raised` | `#151F33` |
| Control/input | `--pc-bg-control` | `#0C1423` |
| Subtle border | `--pc-border-subtle` | `#1F2A44` |
| Strong border | `--pc-border-strong` | `#33415F` |
| Primary text | `--pc-text-primary` | `#F2F5FC` |
| Secondary text | `--pc-text-secondary` | `#AAB4C8` |
| Muted text | `--pc-text-muted` | `#71809C` |
| Brand/selection | `--pc-accent-brand` | `#7C4DFF` |
| Brand hover | `--pc-accent-brand-hover` | `#906BFF` |
| Information/tools | `--pc-state-info` | `#2F8CFF` |
| Path/success | `--pc-state-success` | `#35C76F` |
| Warning/inventory | `--pc-state-warning` | `#F0A51B` |
| Error/destructive | `--pc-state-danger` | `#F0525F` |
| Keyboard focus | `--pc-focus` | `#69A7FF` |

Semantic rules:

- Violet: brand, primary CTA, active workspace, and selected graph family.
- Blue: viewport tools, hotspots, information, and debug state.
- Green: walk paths, success, readiness, and graph start/end states.
- Amber: inventory, warnings, and breakpoints.
- Red: errors, destructive actions, and runtime divergence.
- Color never acts alone; icon, label, shape, or status text remains present.
- Main editor chrome uses the UI sans face. Mono is reserved for IDs, events,
  paths, and data. Editorial serif styling is not used for routine controls.
- Radii are uniform and compact; the current asymmetric panel radius is retired.

The theme package should expose separate editor and player entry points, for
example `studio.css` and `player.css`, while keeping compatibility aliases until
the player migration lands. This avoids changing the player as a side effect of
the editor token PR.

## Target module boundaries

```text
apps/editor/src/ui/
  app/
    EditorApp.tsx
    EditorProviders.tsx
    WorkspaceRouter.tsx
  core/
    project-session/
    navigation/
    preview/
    commands/
  shell/
    StudioTopbar.tsx
    WorkspaceFrame.tsx
    ProjectNavigator.tsx
    InspectorFrame.tsx
  shared/
    components/
    model/
    styles/
  features/
    project/
    scenes/
    narrative/
    assets/
    ai/
    build/
    test-lab/
```

Each feature should normally contain:

- a workspace/view component;
- a feature controller or reducer;
- pure selectors and model helpers;
- inspector and focused subcomponents;
- a feature stylesheet using semantic tokens only;
- focused unit and E2E tests.

`EditorNavigationTarget` remains the cross-workspace navigation contract.
`EditorGateway` remains injectable and is consumed by controllers or a project
command bus. The existing AI candidate/handoff types become an explicit shared
contract between AI, Scenes, and Assets.

## Pull request dependency graph

```mermaid
flowchart TD
  P1["PR-01 Characterization and visual baseline"]
  P2["PR-02 Scoped theme contract"]
  P3["PR-03 foundation"]
  C1["Consolidation: PR-04 + Wave A tranche"]
  LA["Wave A completion launchpad (PR-23 merged)"]
  P5["AI completion"]
  P6["Scenes completion"]
  P7["Assets completion"]
  LB["Wave B boundary launchpad"]
  P8["Narrative and graphs"]
  P9["Shell, Project, and Build"]
  P10["Test Lab and player feedback"]
  P11["Visual convergence and final ratchets"]

  P1 --> P3
  P2 --> P3
  P3 --> C1
  C1 --> LA
  LA --> P5
  LA --> P6
  LA --> P7
  P5 --> LB
  P6 --> LB
  P7 --> LB
  LB --> P8
  LB --> P9
  LB --> P10
  P5 --> P11
  P6 --> P11
  P7 --> P11
  P8 --> P11
  P9 --> P11
  P10 --> P11
```

PR-01 and PR-02 were the parallel prerequisite wave. PR-03, the consolidation
checkpoint, and each launchpad are serial and integrator-owned. Only after a
launchpad is merged do three feature agents work in parallel; this keeps
`EditorApp`, root CSS, shared contracts, and the E2E fixture conflict-free.

## PR plan

### PR-01 - Characterization and visual baseline

Branch: `codex/editor-characterization`
Owner: QA agent
Can run in parallel with: PR-02

Scope:

- Stabilize critical paths: workspace navigation, Scene tree/viewport
  selection, Build-to-source, Narrative-to-Scene, AI apply-to-Assets, and Test
  Lab enter/exit.
- Prefer role and accessible label locators; add `data-testid` only when no
  stable semantic locator exists.
- Capture deterministic screenshots for every workspace and Test Lab.
- Add a line/color budget script with the current values as a no-growth ratchet.
- Include pure UI model files in coverage while continuing to exclude rendered
  view code where appropriate.

Done when existing behavior is frozen without intentional visual changes.

### PR-02 - Scoped theme contract

Branch: `codex/editor-theme-contract`
Owner: visual-system agent
Can run in parallel with: PR-01

Scope:

- Add the semantic tokens listed above, including hover, selected, disabled,
  overlay, elevation, radius, and focus variants.
- Add editor/player theme entry points and backward-compatible aliases.
- Normalize button, input, select, tabs, badge, panel, tooltip, and focus
  primitives without broadly restyling workspaces.
- Initially map compatibility aliases to current values where needed so PR-03
  can remain visually neutral.

Done when token names and primitive state contracts are frozen and the player
has no accidental screenshot diff.

### PR-03 - Mechanical workspace and stylesheet cut

Branch: `codex/editor-modular-foundation`
Owner: integrator
Depends on: PR-01, PR-02

Scope:

- Move workspace JSX into feature directories without changing copy, markup
  semantics, or behavior.
- Split `editor-shell.tsx` by shell responsibility.
- Split the CSS into ordered base, shell, feature, dialog, and responsive
  files, preserving the existing cascade exactly.
- Add `WorkspaceRouter` and explicit typed props for each extracted workspace.
- Remove the late duplicate skin layer by relocating rules, not redesigning
  them in this PR.

Status: delivered in the current foundation checkpoint. The original line
target is retained as a final convergence objective; the current ratchet is
13,200 lines with no intentional visual diff.

### PR-04 - Project/session controllers and command bus

Branch: `codex/editor-session-controller`
Owner: integrator/core agent
Depends on: PR-03

Scope:

- Add `useProjectSessionController`, pure project selectors, recovery/autosave
  adapters, and a project command bus.
- Centralize gateway command execution, project reconciliation, draft cleanup,
  and user-visible error/status handling.
- Add feature-local reducers for Scenes, Assets, AI, and Preview/Build state.
- Keep navigation in the existing typed reducer and preserve the injectable
  gateway seam.

Status: core seams delivered in the consolidation checkpoint. Presentation
components contain no gateway calls; the `EditorApp` composition-root target is
completed incrementally by the feature-completion waves below.

### Wave A - Three parallel feature PRs

The current consolidation contains the first structural tranche, and the
integrator-owned launchpad is now merged as PR-23. The completion wave can
start with three parallel feature branches.

| PR | Branch | Exclusive scope | Visual target |
|---|---|---|---|
| AI completion | `codex/editor-ai-completion` | Provider dialogs, workflow controller, generation/review/apply, handoff and focused E2E | Baseline-neutral |
| Scenes completion | `codex/editor-scenes-completion` | Inspector, direct manipulation, layer/guide controller and focused E2E | Baseline-neutral |
| Assets completion | `codex/editor-assets-completion` | Browser/import, processing, Character Gym controller and focused E2E | Baseline-neutral |

Each completion PR owns only its feature directory and corresponding styles.
Intentional visual migration is deferred to PR-11; no agent edits another
feature or a shared-owned file.

### Wave B - Three parallel feature PRs

These start after Wave A completion and the second serial boundary launchpad.
Scheduling them this way keeps the active squad to one coordinator plus three
feature agents without shared-file collisions.

| PR | Branch | Exclusive scope | Visual target |
|---|---|---|---|
| PR-08 Narrative and graphs | `codex/editor-narrative` | Narrative tree, graph host, nodes/edges/minimap, locale/node inspector, diagnostics and E2E | Semantic node families; violet narrative, green flow endpoints, amber diagnostics |
| PR-09 Shell, Project, and Build | `codex/editor-shell-readiness` | Topbar, workspace tabs, sidebars, status strip, Project, Build, shared shell CSS and focused E2E | Mockup 2-3 density with mockup 4 navy/violet hierarchy |
| PR-10 Test Lab and player feedback | `codex/runtime-feedback-theme` | Test Lab header/tabs/logs/compare plus player HUD, verbs, inventory, dialogue and feedback styles | One runtime/debug language; gameplay and layout behavior unchanged |

### PR-11 - Integration, visual convergence, and final ratchets

Branch: `codex/editor-visual-convergence`
Owner: integrator with visual-system review
Depends on: PR-05 through PR-10

Scope:

- Tune only global tokens, density, elevation, border, focus, and responsive
  behavior that could not be finalized inside one feature.
- Remove compatibility re-exports, dead selectors, and superseded theme values.
- Approve the final screenshot set and document any intentional exceptions.
- Split `editor-session.ts` if it remains above the agreed budget after UI work.
- Lower the no-growth ratchets to the final budgets.

Final budgets:

- `EditorApp.tsx`: 300-500 lines, limited to providers, routing, and wiring.
- A feature component/controller: normally at most 500 lines; 800 is the hard
  ceiling and requires an explicit review note.
- A stylesheet: at most 800 lines.
- Literal colors outside theme files: fewer than 12 documented exceptions per
  application, limited to canvas/content-derived visualization colors.
- No sibling feature imports and no gateway calls in presentation components.

## Multi-agent operating model

Use one coordinator/integrator plus three concurrent worker agents.

| Role | Exclusive ownership |
|---|---|
| Integrator | `EditorApp`, core/session/state/gateway, router/barrels, root style imports, shared E2E fixture, config, package manifests, and lockfile |
| Feature agent | Its `features/<name>/**`, corresponding feature styles, and corresponding focused E2E spec |
| Visual-system agent | `packages/ui-theme/**` and shared primitive styles during PR-02; review-only afterward |
| QA agent | Screenshot harness, budget scripts, and cross-feature characterization tests during PR-01; review-only afterward |

Rules:

- One Git worktree and one `codex/...` branch per agent.
- Open every PR as draft; mark it ready only after its focused and repository
  gates pass.
- PRs target `develop`. Parallel feature branches start from the same merged
  foundation and are rebased on current `develop` before merge.
- Shared-owned files are never edited opportunistically by a feature agent. A
  required contract change becomes a small prerequisite PR owned by the
  integrator.
- `tests/e2e/editor-fixture.ts` is integrator-owned because all feature suites
  depend on it.
- Feature PRs do not modify contracts, manifests, or the lockfile. Necessary
  shared changes are isolated in a prerequisite PR.
- Generated assets, screenshots outside the approved baseline directory, build
  output, and project-specific files remain untracked.

## Quality gates

Every PR must run:

1. Focused unit tests for changed models/controllers.
2. `pnpm --filter @pointclick/editor typecheck`.
3. The focused Playwright spec for the owned feature.
4. Deterministic screenshots for the touched workspace.
5. `pnpm test` and `pnpm typecheck`.
6. `pnpm validate:sample` and `pnpm validate:starter`.
7. `pnpm check` before the PR is marked ready, as required by
   `CONTRIBUTING.md`.

The consolidation checkpoint, both launchpads, and PR-11 additionally require
the full editor E2E suite and a build. PR-11 requires green Windows and Ubuntu
CI, Windows package verification, packaged Electron smoke, CodeQL, and
dependency audit.

Visual baselines use fixed fixtures, DPR 1, disabled animation, and frozen
timestamps at these viewports:

- editor workspaces: `1440x900` and final manual review at `1536x1024` and
  `1920x1080`;
- collapsed editor: `1100x800`;
- Test Lab and player: `1440x900`;
- mobile player: `390x844`.

Recommended screenshot thresholds:

- chrome and primitives: `maxDiffPixelRatio <= 0.003`;
- deterministic scene/canvas: `<= 0.01`, or mask the canvas and compare editor
  overlays separately;
- isolated component states: `<= 0.001`.

Accessibility remains a release gate: normal text contrast at least 4.5:1,
large text and control boundaries at least 3:1, a visible focus indicator of at
least 2 px, keyboard-complete critical flows, and status meaning that does not
depend on color alone.

## Completion criteria

- The final architecture and line budgets are enforced by CI.
- Every workspace has an exclusive module, controller, stylesheet, and focused
  tests.
- Current project open/save, autosave/recovery, undo/redo, authoring, AI apply,
  validation, preview, Test Lab, and player flows remain green.
- Editor, graph, Test Lab, and player feedback share the approved semantic color
  system without losing contrast or focus visibility.
- All implementation reaches `develop` through reviewed pull requests; no
  parallel branch is integrated by copying files or bypassing PR review.
