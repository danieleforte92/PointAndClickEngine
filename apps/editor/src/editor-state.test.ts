import { describe, expect, it } from "vitest";
import {
  createEditorNavigationState,
  editorNavigationReducer,
  parseEditorPanelPreferences
} from "./editor-state";

describe("editor navigation reducer", () => {
  it("restores the previous authoring target when Test Lab closes", () => {
    let state = createEditorNavigationState();
    state = editorNavigationReducer(state, {
      type: "navigate",
      target: { workspace: "scene", sceneId: "dock", entityKind: "hotspot", entityId: "door" }
    });
    state = editorNavigationReducer(state, { type: "test-lab/open" });
    state = editorNavigationReducer(state, { type: "workspace/change", workspace: "build" });
    state = editorNavigationReducer(state, { type: "test-lab/close" });

    expect(state.mode).toBe("authoring");
    expect(state.target).toEqual({
      workspace: "scene",
      sceneId: "dock",
      entityKind: "hotspot",
      entityId: "door"
    });
  });

  it("keeps panel dimensions local, clamped, and independently collapsible", () => {
    let state = createEditorNavigationState({ navigationWidth: 999, inspectorWidth: 10 });
    expect(state.panelPreferences).toMatchObject({ navigationWidth: 420, inspectorWidth: 280 });
    state = editorNavigationReducer(state, { type: "panel/toggle", panel: "inspector" });
    expect(state.panelPreferences.inspectorOpen).toBe(false);
  });

  it("recovers from malformed local preferences", () => {
    expect(parseEditorPanelPreferences("not json")).toMatchObject({
      inspectorOpen: true,
      navigationOpen: true
    });
  });
});
