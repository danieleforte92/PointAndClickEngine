import { describe, expect, it } from "vitest";
import { initialSceneStudioState, sceneStudioReducer } from "./scene-studio-state";

describe("scene studio state", () => {
  it("keeps scene selection transitions immutable", () => {
    const selected = sceneStudioReducer(initialSceneStudioState, { type: "layer/select", layerId: "foreground" });
    const editing = sceneStudioReducer(selected, { type: "tool/select", tool: "walk-area" });

    expect(editing).toMatchObject({ activeTool: "walk-area", selectedLayerId: "foreground" });
    expect(initialSceneStudioState).toMatchObject({ activeTool: "select", selectedLayerId: null });
  });

  it("separates inspector target from viewport selection", () => {
    expect(
      sceneStudioReducer(initialSceneStudioState, { type: "inspector/select", target: "player" }).inspectorTarget
    ).toBe("player");
  });
});
