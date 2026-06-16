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
    const build = workspaceCapabilities.find((capability) => capability.workspace === "build");

    expect(assets?.status).toBe("beta");
    expect(assets?.summary).toContain("import");
    expect(build?.status).toBe("beta");
    expect(build?.summary).toContain("validation");
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
    const pickup = toolCapabilities.find((capability) => capability.id === "tool-pickup");
    const playerStart = toolCapabilities.find((capability) => capability.id === "tool-player-start");
    const walkArea = toolCapabilities.find((capability) => capability.id === "tool-walk-area");

    expect(hotspot?.status).toBe("beta");
    expect(hotspot?.detail).toContain("dragged");
    expect(pickup?.status).toBe("beta");
    expect(playerStart?.status).toBe("beta");
    expect(walkArea?.status).toBe("beta");
    expect(walkArea?.detail).toContain("moved directly");
  });
});
