# Studio Workflows

Use these task-focused procedures after completing the
[authoring tutorial](authoring-tutorial.md). They assume a project is already
open in Point & Click Studio.

## Diagnose And Save A Narrative Graph

1. Open **Narrative** and select a flow from the project tree.
2. Add or select a node. The inspector exposes the fields for its node family.
3. Connect output and input handles. Choice and condition branches have separate
   typed transitions.
4. Use pan, zoom, minimap, or deterministic layout to organize the graph.
5. Resolve diagnostics for missing targets, invalid branches, and unreachable
   nodes. Valid edits autosave after a short pause.

The saved flow keeps node positions in optional `editorLayout` metadata. Runtime
behavior still comes from the flow nodes and their transition fields.

## Find A Resource And Its Usages

1. Open **Resources**.
2. Filter by type or health, then select a scene, asset, animation pack, flow,
   locale, item, prompt pack, style bible, workflow, or recipe.
3. Inspect the usage list to see which project documents reference it.
4. Choose a usage to navigate back to the corresponding authoring workspace.

Resources is a derived view. Changing a filter or selection never writes a new
catalog document into the project.

## Process An Image Without Overwriting Its Source

1. Select an image in **Resources** and open it in **Asset Studio**.
2. Choose **Crop**, **Chroma**, or **Optimize**. For optimization, select the
   intended size/quality preset and output format.
3. Compare source and result previews, dimensions, file weight, and alpha status.
4. Save the processed result. Studio creates a new image asset with parent
   lineage and processing operations; the source stays unchanged.
5. Use the separate assignment action if the new asset should replace a scene,
   player, actor, hotspot, or pickup image.

## Generate And Approve An Image Candidate

1. Open **AI** from a scene target or select a target in **Context**.
2. Confirm the art direction in **Brief** and inputs in **Recipe**.
3. In **Generate**, choose a provider and a batch size from one to four.
4. Start generation. You can cancel a running batch; already returned images
   remain temporary candidates for the current project session.
5. In **Review & Apply**, inspect seed, dimensions, alpha/output warnings,
   provider/model, latency, cost, and provenance.
6. Choose **Discard** or **Apply to Project**. Only Apply writes the image file
   and asset document. Assigning it to a game entity is still separate.

Switching projects prevents candidates from the previous project from being
applied to the new one.

## Compare Embedded And Browser Runtime State

1. Choose **Play** from the authoring shell. Studio enters Test Lab without
   losing the current workspace selection.
2. Interact with the embedded player to record logical actions.
3. Choose **Browser**. The external player replays those actions against the same
   tokenized project session.
4. Return to Test Lab and choose **Refresh**.
5. Open **Compare**. A mismatch reports the first snapshot and field that
   diverged; the other tabs expose state, inventory, dialogue, events, and audio.
6. Choose **Close Test Lab** to return to the previous authoring context.

Test Lab compares logical action boundaries, not DOM events or animation-frame
timing. Preview sessions expire automatically and are served only on loopback.

## Export A Static Web Build

1. Open **Build** and run validation.
2. Resolve every error and save or discard dirty recovery drafts. Warnings do not
   block export unless a specific release policy promotes them to errors.
3. Choose **Export Web Build** and select an empty destination folder.
4. Serve the exported folder with a static HTTP server and open its `index.html`
   entry point through that server.

The export contains the production web player, project asset files, and a
validated `project.bundle.json`. It does not contain Electron APIs or temporary
AI candidates.
