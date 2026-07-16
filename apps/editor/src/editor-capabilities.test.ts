import { describe, expect, it } from "vitest";
import {
  capabilityBadgeLabel,
  capabilityStatusTone,
  toolCapabilities,
  workspaceCapabilities
} from "./editor-capabilities";

describe("editor capabilities", () => {
  it("marks implemented workspaces as usable instead of planned placeholders", () => {
    const assets = workspaceCapabilities.find((capability) => capability.workspace === "assets");
    const ai = workspaceCapabilities.find((capability) => capability.workspace === "ai");
    const build = workspaceCapabilities.find((capability) => capability.workspace === "build");
    const player = workspaceCapabilities.find((capability) => capability.id === "player");
    const scene = workspaceCapabilities.find((capability) => capability.workspace === "scene");

    expect(assets?.status).toBe("beta");
    expect(assets?.summary).toContain("import");
    expect(ai?.status).toBe("beta");
    expect(ai?.summary).toContain("prompt packs");
    expect(player).toBeUndefined();
    expect(scene?.summary).toContain("player setup");
    expect(build?.status).toBe("beta");
    expect(build?.summary).toContain("validation");
  });

  it("does not expose player as a top-level workspace", () => {
    expect(workspaceCapabilities.map((capability) => capability.workspace)).toEqual([
      "overview",
      "scene",
      "flows",
      "narrative",
      "assets",
      "ai",
      "build"
    ]);
  });

  it("presents the home workspace as a project-first surface", () => {
    const project = workspaceCapabilities.find((capability) => capability.workspace === "overview");
    const scene = workspaceCapabilities.find((capability) => capability.workspace === "scene");
    const ai = workspaceCapabilities.find((capability) => capability.workspace === "ai");

    expect(project?.label).toBe("Project");
    expect(project?.summary).toContain("Game settings");
    expect(scene?.label).toBe("Scenes");
    expect(ai?.label).toBe("AI Studio");
  });

  it("keeps badge labels and tones stable for the editor shell", () => {
    expect(capabilityBadgeLabel("available")).toBe("Available");
    expect(capabilityBadgeLabel("beta")).toBe("Beta");
    expect(capabilityStatusTone("available")).toBe("good");
    expect(capabilityStatusTone("beta")).toBe("warn");
    expect(capabilityStatusTone("planned")).toBe("muted");
  });

  it("surfaces viewport tools that are already usable in the scene editor", () => {
    const hotspot = toolCapabilities.find((capability) => capability.id === "tool-hotspot");
    const actor = toolCapabilities.find((capability) => capability.id === "tool-actor");
    const pickup = toolCapabilities.find((capability) => capability.id === "tool-pickup");
    const playerStart = toolCapabilities.find((capability) => capability.id === "tool-player-start");
    const walkArea = toolCapabilities.find((capability) => capability.id === "tool-walk-area");

    expect(hotspot?.status).toBe("beta");
    expect(hotspot?.detail).toContain("dragged");
    expect(actor?.status).toBe("beta");
    expect(actor?.summary).toContain("visible props");
    expect(pickup?.status).toBe("beta");
    expect(playerStart?.status).toBe("beta");
    expect(walkArea?.status).toBe("beta");
    expect(walkArea?.detail).toContain("moved directly");
  });
});
