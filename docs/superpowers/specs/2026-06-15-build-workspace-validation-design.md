# Build Workspace Validation Design

Date: 2026-06-15
Status: Proposed

## Goal

Turn the editor `Build` workspace into a real operational surface for project validation.

This step adds one concrete action:

- run validation for the currently opened project from inside the editor

This keeps the workspace honest and useful without expanding yet into packaging or export workflows.

## Scope

Included:

- a dedicated `Build` workspace panel in the editor UI
- a `Validate project` action wired through IPC
- validation of the currently loaded project directory
- a structured validation report shown inside the editor
- last-run status for `idle`, `running`, `success`, and `failure`
- report details for errors and warnings

Excluded:

- player build or Electron packaging from the editor UI
- CLI log streaming
- background job queues
- validation of arbitrary folders outside the open project
- save or autosave behavior changes

## Why This Shape

The editor already loads project snapshots through `packages/project-io` and already exposes semantic diagnostics on load. That gives us a trusted validation path inside the application process.

Instead of shelling out to the CLI, this step reuses the same data model and validation logic directly in the Electron main process. That keeps the first `Build` slice fast, deterministic, and consistent with the rest of the editor architecture.

## Approaches Considered

### Option A: Read-only Build workspace

Show only the diagnostics already attached to the current snapshot.

Rejected because the workspace would remain descriptive rather than operational, and the `Validate project` affordance would not add real value.

### Option B: In-process validation through `project-io`

Run validation in the Electron main process against the currently open project and return a structured report to the renderer.

Chosen because it matches existing editor architecture, avoids shell-process complexity, and keeps validation logic close to the project-loading path.

### Option C: Spawn the CLI from the editor

Invoke the existing validate command and parse its output.

Rejected for this step because it introduces unnecessary process management, slower feedback, and output parsing complexity for behavior that already exists in-process.

## Architecture

### Main process

Add a dedicated validation handler alongside the current project and preview handlers.

Responsibilities:

- resolve the currently opened project directory
- load the project bundle with the same `project-io` path used by the editor
- run semantic validation
- return a structured report to the renderer

The handler should not mutate project files or editor drafts. It is a read-only check.

### Preload bridge

Expose one new renderer-facing method:

- `runValidation(): Promise<EditorValidationReport>`

This keeps the renderer isolated from Electron and mirrors the existing preload command style.

### Renderer

Upgrade the `Build` workspace from placeholder content to a proper validation panel.

The panel should show:

- workspace summary
- `Validate project` button
- current run state
- last validation timestamp
- validation outcome summary
- full diagnostics list
- preview readiness summary using:
  - validation errors
  - validation warnings
  - unsaved drafts

## Data Model

Add a small report shape shared across main, preload, and renderer:

- `status`: `success` or `failure`
- `projectDirectory`
- `ranAt`
- `diagnostics`
- optional `summary`

The renderer also keeps transient local UI state:

- `idle`
- `running`
- `completed`
- `failed-to-run`

`failed-to-run` is for transport or unexpected process errors. Validation findings themselves still return a successful report payload with warning and error diagnostics.

## Validation Behavior

The validation action should:

1. use the currently opened project directory
2. load the saved project from disk
3. run the same semantic checks used to derive snapshot diagnostics
4. return all diagnostics in a structured list

Important behavior:

- validation works on saved project content, not unsaved editor drafts
- the UI explicitly tells the user when dirty drafts exist
- validation errors do not block the workspace from rendering results

## UI Design

### Validation card

Top-level card with:

- title
- short description
- button `Validate project`
- inline status text

Button states:

- enabled when a project is loaded and no validation is running
- disabled while validation is running

### Result summary

After a run, show:

- pass/warn/error tone
- counts for errors and warnings
- timestamp of the last completed run

### Diagnostics list

Each diagnostic row shows:

- severity
- message
- optional document or entity context

If there are no diagnostics, show a positive empty state.

### Preview readiness note

Build should also summarize whether preview is currently trustworthy:

- blocked by validation errors
- review recommended because of warnings
- preview differs from validation target when unsaved drafts exist

This keeps the distinction clear between:

- validating saved content
- previewing saved content
- previewing draft content

## Error Handling

Two failure classes need different treatment:

### Validation findings

These are normal results and should be rendered as report data.

Examples:

- missing flow reference
- missing locale key
- invalid initial scene reference

### Execution failure

These are unexpected failures while trying to run validation.

Examples:

- no project loaded
- disk read failure
- malformed file that prevents project loading

These should surface as status text in the workspace and preserve the last successful report if one exists.

## Testing

Add focused coverage for:

- main/preload validation bridge typing and behavior
- successful validation with a clean project
- validation report with diagnostics
- renderer state transitions for idle, running, and completed states

Verification pass:

- `pnpm test`
- `pnpm typecheck`
- `pnpm validate:sample`
- `pnpm --filter @pointclick/editor build`

## Implementation Sequence

1. add shared validation report types in the editor bridge
2. add main-process validation handler using existing project loading and diagnostics helpers
3. expose the new preload API
4. replace the `Build` placeholder UI with the validation panel
5. add focused tests
6. run validation and build checks

## Risks And Limits

- validation targets saved disk state, so users may confuse it with draft preview unless the UI states the difference clearly
- malformed project files may fail before producing structured diagnostics, so execution failures need separate messaging
- this step deliberately stops short of packaging and export to keep the workspace focused

## Done Criteria

This step is complete when:

- the editor `Build` workspace can run validation for the open project
- results are shown inside the editor with clear status and diagnostics
- the UI distinguishes saved-content validation from unsaved draft preview
- automated checks pass
