import { describe, expect, it } from "vitest";
import { createSceneStudioController } from "./scene-studio-controller";
import { initialSceneStudioState } from "./scene-studio-state";

describe("Scenes controller", () => {
  it("exposes semantic tool labels and manipulation readiness", () => {
    const controller = createSceneStudioController();
    const next = controller.reduce(initialSceneStudioState, { type: "tool/select", tool: "walk-area" });
    expect(controller.selectionLabel(next)).toBe("Walk area");
    expect(controller.canManipulate(next, true)).toBe(true);
    expect(controller.canManipulate(next, false)).toBe(false);
  });
});
