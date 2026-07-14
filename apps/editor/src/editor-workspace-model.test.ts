import { describe, expect, it } from "vitest";
import { workspaceCapabilities } from "./editor-capabilities";
import { stageToolbarModelFor } from "./editor-workspace-model";

function capabilityFor(workspace: Parameters<typeof stageToolbarModelFor>[0]["workspace"]) {
  return workspaceCapabilities.find((capability) => capability.workspace === workspace)!;
}

describe("stage toolbar model", () => {
  it("summarizes the active scene selection and entity counts", () => {
    expect(
      stageToolbarModelFor({
        hasSelectedScene: true,
        sceneLabel: "House",
        selectedSceneActorCount: 2,
        selectedSceneHotspotCount: 6,
        selectedScenePickupCount: 4,
        selectedSceneToolLabel: "Select",
        workspace: "scene",
        workspaceCapability: capabilityFor("scene")
      })
    ).toEqual({
      badgeLabel: "Select",
      badgeTone: "warn",
      detail: "6 hotspot(s) / 4 pickup(s) / 2 actor(s)",
      primaryLabel: "House"
    });
  });

  it("falls back to the scene capability when no scene is selected", () => {
    const model = stageToolbarModelFor({
      hasSelectedScene: false,
      sceneLabel: "",
      selectedSceneActorCount: 0,
      selectedSceneHotspotCount: 0,
      selectedScenePickupCount: 0,
      selectedSceneToolLabel: "Hotspot",
      workspace: "scene",
      workspaceCapability: capabilityFor("scene")
    });

    expect(model.badgeLabel).toBe("Hotspot");
    expect(model.badgeTone).toBe("warn");
    expect(model.detail).toContain("Edit scenes");
    expect(model.primaryLabel).toBe("Scenes");
  });

  it("uses project-first wording for the overview workspace", () => {
    expect(
      stageToolbarModelFor({
        hasSelectedScene: false,
        sceneLabel: "",
        selectedSceneActorCount: 0,
        selectedSceneHotspotCount: 0,
        selectedScenePickupCount: 0,
        selectedSceneToolLabel: "Select",
        workspace: "overview",
        workspaceCapability: capabilityFor("overview")
      })
    ).toMatchObject({
      badgeLabel: "Available",
      badgeTone: "good",
      detail: "Project command center and readiness",
      primaryLabel: "Project"
    });
  });

  it("keeps narrative copy distinct from generic capability summaries", () => {
    expect(
      stageToolbarModelFor({
        hasSelectedScene: false,
        sceneLabel: "",
        selectedSceneActorCount: 0,
        selectedSceneHotspotCount: 0,
        selectedScenePickupCount: 0,
        selectedSceneToolLabel: "Select",
        workspace: "narrative",
        workspaceCapability: capabilityFor("narrative")
      })
    ).toMatchObject({
      badgeLabel: "Beta",
      badgeTone: "warn",
      detail: "Structured flow and locale editing",
      primaryLabel: "Narrative"
    });
  });
});
