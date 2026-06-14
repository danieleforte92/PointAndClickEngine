# Undo Redo And Autosave Recovery Design

Date: 2026-06-14
Status: Proposed

## Goal

Add editor-side undo and redo for local draft editing, plus autosave recovery for unapplied drafts, without changing how project files are persisted.

## Scope

Included:

- undo and redo for local draft edits in:
  - hotspot inspector
  - scene inspector
  - locale inspector
  - flow inspector
- dirty tracking for edited documents
- project-scoped autosave recovery for unapplied drafts
- restore prompt when a matching recovery snapshot exists
- explicit separation between local recovery data and project file persistence

Excluded:

- recovery of full undo and redo history across app restarts
- automatic writes into the actual project documents
- collaborative conflict handling
- cross-project recovery merge
- binary asset recovery

## Why This Shape

The editor now supports real authoring across scenes, hotspots, locales, and flows. That makes draft safety and reversible editing more important than before.

This step should improve confidence without changing the existing command pipeline:

- draft editing stays local until `Apply changes`
- project files still change only through validated commands
- autosave only protects local work in progress

## Options Considered

### Option A: Centralized draft session snapshots

Maintain one editor-side session model containing selection, drafts, dirty state, and undo/redo stacks.

This is the chosen option because it gives a coherent behavior model across all inspector types and keeps recovery serialization straightforward.

### Option B: Per-inspector mini histories

Each inspector owns its own history and recovery blob.

Rejected for now because selection changes would create uneven behavior and make later unification more painful.

### Option C: Event log replay

Store field-level events and reconstruct state by replaying them.

Rejected for now because it is more complex than needed for this stage and raises implementation risk.

## Architecture

### Editor draft session

Introduce a local editor session model in the renderer with:

- active selection metadata
- draft state for each editable document type
- dirty flags
- undo stack
- redo stack

The draft session is renderer-local. It does not replace project loading or command persistence in the main process.

### Persistence boundary

Project writes remain unchanged:

- renderer builds a validated command
- preload forwards it
- main process applies it
- `project-io` writes the actual project document

Autosave recovery writes a separate local recovery file. It never updates the source project automatically.

### Recovery storage

The editor main process should expose a small IPC surface for:

- load recovery snapshot for the current project
- save recovery snapshot
- clear recovery snapshot after successful apply or explicit discard

Recovery files should live under the editor app data directory and be keyed by project path in a filesystem-safe way.

## Data Model

Suggested renderer model:

- `EditorDraftSession`
  - `selection`
  - `drafts`
  - `dirty`
  - `undoStack`
  - `redoStack`

Suggested recovery payload:

- `projectDirectory`
- `savedAt`
- `selection`
- dirty draft data only

The saved payload should be JSON-serializable and avoid storing large derived structures.

## Undo And Redo Behavior

- every local form edit creates a new draft snapshot
- undo moves one step backward in the local session stack
- redo moves one step forward
- applying a document does not write into undo history for other documents
- switching selection should preserve draft state for dirty documents

Behavioral rule:

- undo and redo operate on local draft state, not on already-persisted project files

If the user applies a draft to the project and then keeps editing, undo should still work against the local draft state after the apply.

## Autosave Recovery Behavior

- autosave triggers after local edits with a short debounce
- only dirty draft state is saved
- on editor startup or project open, if recovery exists for that exact project directory, the editor offers restore
- restore repopulates local draft state and active selection
- discard removes the recovery snapshot

Successful project apply should clear the saved recovery for the just-applied document if that document is no longer dirty.

## UI Design

### Controls

Add visible `Undo` and `Redo` actions in the top bar or inspector area.

Optional but recommended:

- keyboard shortcuts for undo and redo using standard platform conventions

### Dirty feedback

Show lightweight dirty state in the inspector or project panel so the user can tell when they have unapplied changes.

### Recovery prompt

When a matching recovery snapshot exists, show a simple prompt:

- restore drafts
- discard recovery

The prompt should appear before the user starts editing, and should not silently overwrite freshly loaded state.

## Error Handling

- failure to write recovery data must not block normal editing
- corrupted recovery data should be ignored with a clear status message
- project command failures should leave local drafts intact
- undo and redo should no-op safely when their respective stack is empty

## Testing

Add coverage for:

- draft history transitions for undo and redo
- recovery serialization and load behavior
- restoring drafts for a matching project path
- clearing recovery after discard or clean apply where applicable

Verification pass:

- `pnpm test`
- `pnpm typecheck`
- `pnpm validate:sample`
- `pnpm --filter @pointclick/editor typecheck`
- `pnpm --filter @pointclick/editor build`

## Implementation Notes

Suggested order:

1. define draft session and recovery snapshot types
2. add main-process IPC for recovery load/save/clear
3. implement renderer history and dirty tracking
4. wire undo and redo controls
5. add autosave debounce and restore prompt
6. verify apply flows keep local drafts and recovery consistent

## Risks And Limits

- snapshot-based history can grow quickly if not kept tight, so stacks should stay bounded
- restoring drafts across schema evolution is out of scope for this step
- if the current editor component remains large, this feature may justify extracting session helpers to keep the UI manageable

## Done Criteria

This step is complete when:

- local draft edits can be undone and redone across the supported inspectors
- dirty drafts survive editor restart through recovery storage
- recovery never writes directly into project source files
- project apply still goes only through validated commands
- automated validation passes
